#!/usr/bin/env node
// Остановки, маршруты и расписания Краснодара с официального сайта КТТУ (proezd.kttu.ru,
// движок stops.lt) -> data/ground_transport/*.json в формате админки
// (admin/api/src/lib/collections.js) и пассажирского сайта.
//
//   node data/import_kttu.mjs
//
// У КТТУ геометрии нет. Линии трамваев - кратчайший путь по трамвайным путям из OSM между
// соседними остановками (data/kttu/tramTracks.mjs). Линии троллейбусов и автобусов строит
// публичный OSRM (router.project-osrm.org, профиль driving) по остановкам - не чаще раза в
// секунду, с кэшем в data/kttu/osrm-cache.json. Если OSRM недоступен или дал петлю
// (длиннее 1.6 прямой), линия - ломаная по остановкам (approximate: true).
//
// Дальше - в базу админки:
//   (cd admin/api && npm run seed -- --only=ground_transport/routes,ground_transport/stops,\
//     ground_transport/route_stops,ground_transport/route_geometry,ground_transport/schedule_trips --force --yes)
//
// id маршрута - FNV-1a от «Тм|1», «Тб|2», «А|96», как routeIdFor в server/src/upstreamClient.js:
// так живая машина из фида krdpt сразу находит свой маршрут.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { explodeTimes } from './kttu/explodeTimes.mjs';
import { loadTramTracks } from './kttu/tramTracks.mjs';

const BASE_URL = 'http://proezd.kttu.ru/krasnodar/krasnodar';
const OUT = path.join(import.meta.dirname, 'ground_transport');

const TRANSPORT = {
  tram: { rtype: 'Тм', name: 'Трамвай' },
  trol: { rtype: 'Тб', name: 'Троллейбус' },
  bus: { rtype: 'А', name: 'Автобус' },
};
const TRANSPORT_ORDER = Object.keys(TRANSPORT);
const DAY_MS = 24 * 60 * 60 * 1000;
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_CACHE = path.join(import.meta.dirname, 'kttu', 'osrm-cache.json');
const MAX_DETOUR = 1.6;

const TRAM_TRACKS = path.join(import.meta.dirname, 'kttu', 'osm-tram.json');

// Буквы в номерах - кириллицей («2Е»), как в живом фиде krdpt; у КТТУ бывает латиница.
const toCyrillic = (s) => s.replace(/[ABCEHKMOPTX]/g, (ch) => 'АВСЕНКМОРТХ'['ABCEHKMOPTX'.indexOf(ch)]);
const clean = (s) => s.replace(/\s+/g, ' ').replace(/ — /g, ' – ').trim();

function routeIdFor(rtype, number) {
  let hash = 2166136261;
  for (const ch of `${rtype}|${number}`) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function download(name) {
  const res = await fetch(`${BASE_URL}/${name}?${Date.now()}`, { headers: { 'User-Agent': 'Mozilla/5.0 (krasnodar-transport data import)' } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return (await res.text()).replace(/^﻿/, '');
}

/** Таблица с заголовком; пустая ячейка = значение из предыдущей строки (формат stops.lt). */
function header(line) {
  return Object.fromEntries(line.split(';').map((h, i) => [h.trim().toUpperCase(), i]));
}

function parseStops(text) {
  const lines = text.split(/\r?\n/);
  const col = header(lines[0]);
  const stops = new Map();
  let name = '';
  for (const line of lines.slice(1)) {
    if (line.length < 2) continue;
    const x = line.split(';');
    if (x[col.NAME]) name = x[col.NAME] === '0' ? '' : x[col.NAME];
    stops.set(x[col.ID], { kttuId: x[col.ID], name: clean(name), lat: +x[col.LAT] / 1e5, lng: +x[col.LNG] / 1e5 });
  }
  return stops;
}

function parseRoutes(text) {
  const lines = text.split(/\r?\n/);
  const col = header(lines[0]);
  const variants = [];
  const cur = {};
  for (let u = 1; u < lines.length; u++) {
    const line = lines[u];
    if (line.length < 2 || line[0] === '#') continue;
    const x = line.split(';');
    for (const key of ['ROUTENUM', 'TRANSPORT', 'OPERATOR']) {
      if (x[col[key]]) cur[key] = x[col[key]] === '0' ? '' : x[col[key]];
    }
    if (x[col.ROUTENAME]) cur.ROUTENAME = x[col.ROUTENAME];
    const times = lines[++u];
    if (cur.ROUTENAME.includes('разв')) continue; // служебные развозки, planner.js их тоже пропускает
    variants.push({
      transport: cur.TRANSPORT,
      number: toCyrillic(cur.ROUTENUM),
      operator: cur.OPERATOR,
      type: x[col.ROUTETYPE], // a-b, b-a - основные; a-d, d-b... - в депо и из депо
      name: clean(cur.ROUTENAME),
      // Префиксы e/x - «только посадка»/«только высадка», для нас это та же остановка.
      stops: x[col.ROUTESTOPS].split(',').map((s) => s.replace(/^[ex]/, '')),
      schedule: explodeTimes(times),
    });
  }
  return variants;
}

const dist2 = (a, b) => (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;
const metres = (a, b) => Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let osrmCache = {};
try {
  osrmCache = JSON.parse(readFileSync(OSRM_CACHE, 'utf-8'));
} catch {}

/** Линия по дорогам через все остановки направления или null. */
async function roadLine(stations) {
  const coords = stations.map((s) => `${s.lng.toFixed(6)},${s.lat.toFixed(6)}`).join(';');
  if (!(coords in osrmCache)) {
    await sleep(1000);
    try {
      const res = await fetch(`${OSRM_URL}/${coords}?overview=full&geometries=geojson`, {
        headers: { 'User-Agent': 'krasnodar-transport data import' },
        signal: AbortSignal.timeout(30_000),
      });
      const body = await res.json();
      const route = body.routes?.[0];
      osrmCache[coords] = route ? { distance: route.distance, coordinates: route.geometry.coordinates } : null;
    } catch (error) {
      console.warn(`OSRM: ${error.message}`);
      return null;
    }
  }
  const route = osrmCache[coords];
  let straight = 0;
  for (let i = 1; i < stations.length; i++) straight += metres(stations[i - 1], stations[i]);
  if (!route || route.distance > straight * MAX_DETOUR) return null;
  return route.coordinates.map(([lng, lat]) => ({ lat, lng }));
}
const hhmm = (minutes) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

async function main() {
  const [stopsText, routesText] = await Promise.all([download('stops.txt'), download('routes.txt')]);
  const kttuStops = parseStops(stopsText);
  const variants = parseRoutes(routesText);
  const tramLine = loadTramTracks(TRAM_TRACKS);
  const today = Math.floor(Date.now() / DAY_MS);

  // id остановки - число из id КТТУ; «079» и «79» у них разные остановки, поэтому ведущие
  // нули не отбрасываем, а переносим в старший разряд: 079 -> 1_000_079.
  const stopIdOf = (kttuId) => (kttuId.startsWith('0') ? 1_000_000 * (kttuId.length - String(+kttuId).length) + +kttuId : +kttuId);

  const byRoute = new Map();
  for (const v of variants) {
    if (!TRANSPORT[v.transport]) continue;
    const key = `${v.transport}|${v.number}`;
    if (!byRoute.has(key)) byRoute.set(key, []);
    byRoute.get(key).push(v);
  }

  const usedStops = new Map();
  const routes = [];
  const routeStops = [];
  const geometry = [];
  const trips = [];
  let nextSubrouteId = 1;

  const keys = [...byRoute.keys()].sort((a, b) => {
    const [ta, na] = a.split('|');
    const [tb, nb] = b.split('|');
    return TRANSPORT_ORDER.indexOf(ta) - TRANSPORT_ORDER.indexOf(tb) || parseInt(na, 10) - parseInt(nb, 10) || na.localeCompare(nb);
  });

  for (const key of keys) {
    const [transport, number] = key.split('|');
    const { rtype, name: typeName } = TRANSPORT[transport];
    const routeId = routeIdFor(rtype, number);
    const shortName = `${rtype}-${number}`;
    // Основные направления первыми (сайт показывает их по умолчанию), затем по числу рейсов.
    const rank = (v) => (v.type === 'a-b' ? 0 : v.type === 'b-a' ? 1 : 2);
    const list = byRoute.get(key).sort((a, b) => rank(a) - rank(b) || b.schedule.trips - a.schedule.trips);

    const directions = [];
    for (const v of list) {
      const stations = v.stops
        .map((id) => kttuStops.get(id) && { id: stopIdOf(id), ...kttuStops.get(id) })
        .filter(Boolean);
      if (stations.length < 2) continue;
      for (const s of stations) usedStops.set(s.id, { id: s.id, name: s.name, direction: 0, lat: s.lat, lng: s.lng });

      const direction = {
        subrouteId: nextSubrouteId++,
        directionTo: stations.at(-1).name,
        forward: true,
        stopsCount: stations.length,
        stations: stations.map(({ id, name, lat, lng }) => ({ id, name, lat, lng })),
      };
      directions.push(direction);

      // Рейсы, которые действуют сегодня; будни - есть день 1-5, выходные - 6 или 7.
      const { trips: count, times, validFrom, validTo, workdays } = v.schedule;
      if (count * v.stops.length !== times.length) throw new Error(`${shortName} ${v.type}: матрица расписания не сходится`);
      const seen = new Set();
      for (let k = 0; k < count; k++) {
        if (validFrom[k] > today || (validTo[k] && validTo[k] < today)) continue;
        const dayTypes = [];
        if (/[1-5]/.test(workdays[k])) dayTypes.push('будни');
        if (/[67]/.test(workdays[k])) dayTypes.push('выходные');
        // Последняя остановка - только прибытие, отправлений с неё нет.
        for (let i = 0; i < v.stops.length - 1; i++) {
          const stop = kttuStops.get(v.stops[i]);
          if (!stop) continue;
          const stopId = stopIdOf(v.stops[i]);
          const time = hhmm(times[i * count + k]);
          for (const dayType of dayTypes) {
            const dedupe = `${stopId}|${dayType}|${time}`;
            if (seen.has(dedupe)) continue;
            seen.add(dedupe);
            trips.push({
              stop_id: stopId,
              stop_name: stop.name,
              route_number: number,
              route_type: typeName,
              route_shortName: shortName,
              day_type: dayType,
              time,
              to_station: direction.directionTo,
            });
          }
        }
      }
    }
    if (directions.length === 0) continue;

    // «Туда» - вариант начинается ближе к началу основного направления, чем к его концу.
    const main = directions[0];
    const [start, end] = [main.stations[0], main.stations.at(-1)];
    for (const d of directions) d.forward = dist2(d.stations[0], start) <= dist2(d.stations[0], end);

    const route = {
      id: routeId,
      type: typeName,
      number,
      shortName,
      name: `${main.stations[0].name} – ${main.directionTo}`,
      fromStation: main.stations[0].name,
      toStation: main.directionTo,
    };
    routes.push({ ...route, companyName: list[0].operator || 'МУП КТТУ' });
    routeStops.push({ ...route, directions });

    for (const d of directions) {
      let points = transport === 'tram' ? tramLine(d.stations) : await roadLine(d.stations);
      const approximate = !points;
      points ??= d.stations.map(({ lat, lng }) => ({ lat, lng }));
      geometry.push({
        routeId,
        routeNumber: number,
        routeShortName: shortName,
        subrouteId: d.subrouteId,
        directionName: d.directionTo,
        forward: d.forward,
        approximate,
        points,
      });
    }
  }

  mkdirSync(OUT, { recursive: true });
  const write = (name, data) => {
    writeFileSync(path.join(OUT, name), `${JSON.stringify(data)}\n`);
    console.log(`${name}: ${data.length}`);
  };
  write('stops.json', [...usedStops.values()].sort((a, b) => a.id - b.id));
  write('routes.json', routes);
  write('route_stops.json', routeStops);
  write('route_geometry.json', geometry);
  write('schedule_trips.json', trips);
  writeFileSync(OSRM_CACHE, `${JSON.stringify(osrmCache)}\n`);
  console.log(`линии по дорогам и рельсам: ${geometry.filter((g) => !g.approximate).length} из ${geometry.length}`);
}

await main();
