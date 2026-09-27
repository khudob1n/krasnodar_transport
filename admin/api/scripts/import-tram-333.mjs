// Трамвай 333 (ул. Фрезеровщиков – Верхняя Пышма, ООО «Верхнепышминский трамвай»).
// На городском портале его нет - другой перевозчик, поэтому справочники собираются здесь:
//   - остановки и трасса - из OpenStreetMap (отношения route=tram ref=333, оба направления);
//   - расписание - поминутное по каждой остановке с kudikina.ru (одинаковое во все дни).
// Живых координат нет: машины 333 ведёт платформа «Датапакс», открытого фида у неё нет.
//
//   node scripts/import-tram-333.mjs --fetch   скачать и дописать строки 333 в data/ground_transport/*.json
//   node --env-file=.env scripts/import-tram-333.mjs --db   загрузить строки 333 из data/ в базу админки
//
// Оба режима идемпотентны: старые строки 333 сначала убираются, остальные данные не трогаются
// (в отличие от seed --force, который перезаливает коллекцию целиком вместе с правками из админки).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COLLECTIONS } from '../src/lib/collections.js';
import { DATA_DIR } from '../src/lib/paths.js';

const ROUTE_ID = 90333;
const NUMBER = '333';
const TYPE = 'Трамвай';
const SHORT_NAME = 'Тм-333';
const COMPANY = 'ООО «Верхнепышминский трамвай»';
/** Id новых остановок - с запасом выше id портала (сейчас до ~16 000). */
const STOP_ID_BASE = 900000;
const DAY_TYPES = ['будни', 'выходные'];

const OVERPASS = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const KUDIKINA = 'https://kudikina.ru/ekb/tram/333';
const UA = 'Mozilla/5.0 (ekaterinburg-transport data import)';

const FILES = ['routes', 'route_stops', 'route_geometry', 'stops', 'schedule_trips'];
const file = (name) => path.join(DATA_DIR, 'ground_transport', `${name}.json`);
const read = (name) => JSON.parse(readFileSync(file(name), 'utf-8'));

const is333Route = (row) => row.id === ROUTE_ID || row.routeId === ROUTE_ID;
const is333Trip = (row) => row.route_type === TYPE && row.route_number === NUMBER;
const is333Stop = (row) => row.id >= STOP_ID_BASE && row.id < STOP_ID_BASE + 1000;

function distance(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// «Улица Фрезеровщиков» и «Фрезеровщиков» - одна остановка. \b в JS кириллицу не видит,
// поэтому служебные слова убираются по словам, а не регуляркой.
const GENERIC_WORDS = new Set(['улица', 'ул', 'переулок', 'пер', 'парк', 'озеро']);
const normalize = (name) =>
  name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"().,–-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !GENERIC_WORDS.has(word))
    .sort()
    .join(' ');

// В OSM конечная в Верхней Пышме - просто «Трамвайное кольцо»; на табличках и в расписании
// с названием города, иначе не понять, какое это кольцо.
const TERMINAL_NAMES = { 'Трамвайное кольцо': 'Верхняя Пышма – Трамвайное кольцо' };

// ---------- OSM ----------

async function fetchOsm() {
  const query = `[out:json][timeout:60];
    relation["route"="tram"]["ref"="${NUMBER}"](56.70,60.45,57.05,60.75)->.rel;
    .rel out body;
    way(r.rel)->.ways;
    .ways out body;
    node(w.ways);
    out skel;
    node(r.rel);
    out body;`;
  // Overpass перегружен: пробуем несколько раз.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
    }).catch(() => null);
    if (response?.ok) return response.json();
    console.warn(`[333] Overpass: попытка ${attempt} не удалась (${response?.status ?? 'сеть'})`);
  }
  throw new Error('Overpass недоступен');
}

/** Пути отношения по порядку -> одна линия (путь переворачивается, если идёт навстречу). */
function chainWays(relation, ways, nodes) {
  const line = [];
  for (const member of relation.members.filter((m) => m.type === 'way' && !m.role)) {
    const way = ways.get(member.ref);
    if (!way) continue;
    let points = way.nodes.map((id) => nodes.get(id)).filter(Boolean);
    if (line.length) {
      const last = line[line.length - 1];
      const toStart = distance(last, points[0]);
      const toEnd = distance(last, points[points.length - 1]);
      if (toEnd < toStart) points = points.reverse();
      if (distance(last, points[0]) < 1) points = points.slice(1);
    } else {
      // Первый путь: ориентируем по второму.
      const next = relation.members.find((m) => m.type === 'way' && !m.role && m.ref !== member.ref);
      const nextWay = next && ways.get(next.ref);
      if (nextWay) {
        const ends = [nextWay.nodes[0], nextWay.nodes[nextWay.nodes.length - 1]].map((id) => nodes.get(id));
        const first = points[0];
        if (ends.some((end) => end && distance(end, first) < 1)) points = points.reverse();
      }
    }
    line.push(...points);
  }
  return line.map(({ lat, lng }) => ({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) }));
}

// ---------- Расписание ----------

async function fetchTimetable(direction) {
  const response = await fetch(`${KUDIKINA}/${direction}`, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`kudikina ${direction}: HTTP ${response.status}`);
  const html = await response.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;|&#8211;/g, '–');
  const sections = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const header = line.match(/^(\d+)\) (.+)$/);
    if (header) sections.push({ name: header[2], times: [] });
    else if (sections.length && /^\d\d:\d\d$/.test(line)) sections[sections.length - 1].times.push(line);
  }
  return sections;
}

// ---------- Сборка ----------

async function build() {
  const osm = await fetchOsm();
  const nodes = new Map();
  const ways = new Map();
  const relations = [];
  for (const el of osm.elements) {
    if (el.type === 'node') nodes.set(el.id, { ...nodes.get(el.id), lat: el.lat, lng: el.lon, tags: el.tags ?? nodes.get(el.id)?.tags });
    if (el.type === 'way') ways.set(el.id, el);
    if (el.type === 'relation') relations.push(el);
  }
  if (relations.length !== 2) throw new Error(`ожидались 2 направления в OSM, пришло ${relations.length}`);

  const portalStops = read('stops').filter((s) => !is333Stop(s));
  const tramStopIds = new Set(
    read('route_stops')
      .filter((r) => r.type === TYPE && !is333Route(r))
      .flatMap((r) => r.directions.flatMap((d) => d.stations.map((s) => s.id))),
  );

  const newStops = [];
  // Остановка OSM -> id: трамвайная остановка портала рядом с тем же названием (кольцо
  // «Фрезеровщиков», общее с 14-м), иначе своя. Автобусные «Шефская» и т. п. не берём -
  // это другая площадка, пересадку на них найдёт пешком планировщик.
  const stopIdFor = (node, name) => {
    const near = portalStops.find(
      (s) => tramStopIds.has(s.id) && distance(s, node) < 120 && normalize(s.name) === normalize(name),
    );
    if (near) return near.id;
    const same = newStops.find((s) => distance(s, node) < 25 && s.name === name);
    if (same) return same.id;
    const stop = { id: STOP_ID_BASE + newStops.length + 1, name, direction: 0, lat: +node.lat.toFixed(6), lng: +node.lng.toFixed(6) };
    newStops.push(stop);
    return stop.id;
  };

  // Направление A у kudikina - от Фрезеровщиков, B - от Верхней Пышмы.
  const timetables = { A: await fetchTimetable('A'), B: await fetchTimetable('B') };

  const directions = [];
  const geometry = [];
  const trips = [];

  relations
    .map((relation) => {
      const stopMembers = relation.members.filter((m) => m.type === 'node' && m.role.startsWith('stop'));
      const firstName = nodes.get(stopMembers[0].ref)?.tags?.name ?? '';
      return { relation, stopMembers, fromFrezer: /Фрезеровщиков/.test(firstName) };
    })
    .sort((a, b) => Number(b.fromFrezer) - Number(a.fromFrezer))
    .forEach(({ relation, stopMembers, fromFrezer }, index) => {
      const table = timetables[fromFrezer ? 'A' : 'B'];
      if (table.length !== stopMembers.length) {
        throw new Error(`остановок в OSM ${stopMembers.length}, в расписании ${table.length} - сверить вручную`);
      }
      const subrouteId = ROUTE_ID * 10 + index + 1;
      const stations = stopMembers.map((member, i) => {
        const node = nodes.get(member.ref);
        if (!node) throw new Error(`нет узла остановки ${member.ref} в ответе Overpass`);
        // Названия - из OSM (у кольца «Фрезеровщиков» возьмётся остановка портала), расписание
        // сопоставляется по порядку остановок - их число сверено выше.
        const osmName = node.tags?.name ?? table[i].name;
        const name = TERMINAL_NAMES[osmName] ?? osmName;
        const id = stopIdFor(node, name);
        const stop = portalStops.find((s) => s.id === id) ?? newStops.find((s) => s.id === id);
        return { id, name: stop.name, lat: stop.lat, lng: stop.lng };
      });
      const directionTo = stations[stations.length - 1].name;

      directions.push({ subrouteId, directionTo, forward: fromFrezer, stopsCount: stations.length, stations });
      geometry.push({
        routeId: ROUTE_ID,
        routeNumber: NUMBER,
        routeShortName: SHORT_NAME,
        subrouteId,
        directionName: directionTo,
        forward: fromFrezer,
        points: chainWays(relation, ways, nodes),
      });

      // Последнюю остановку (конечную) в расписание отправлений не пишем - с неё не уезжают.
      stations.slice(0, -1).forEach((station, i) => {
        for (const day_type of DAY_TYPES) {
          for (const time of table[i].times) {
            trips.push({
              stop_id: station.id,
              stop_name: station.name,
              route_number: NUMBER,
              route_type: TYPE,
              route_shortName: SHORT_NAME,
              day_type,
              time,
              to_station: directionTo,
            });
          }
        }
      });
    });

  const fromStation = directions[0].stations[0].name;
  const toStation = directions[0].directionTo;
  const route = {
    id: ROUTE_ID,
    type: TYPE,
    number: NUMBER,
    shortName: SHORT_NAME,
    name: `${fromStation} – Верхняя Пышма`,
    fromStation,
    toStation,
    companyName: COMPANY,
  };

  return {
    routes: [route],
    route_stops: [{ ...route, directions }],
    route_geometry: geometry,
    stops: newStops,
    schedule_trips: trips,
  };
}

function writeData(rows) {
  const drop = { routes: is333Route, route_stops: is333Route, route_geometry: is333Route, stops: is333Stop, schedule_trips: is333Trip };
  for (const name of FILES) {
    const kept = read(name).filter((row) => !drop[name](row));
    writeFileSync(file(name), `${JSON.stringify([...kept, ...rows[name]], null, 2)}\n`);
    console.log(`[333] ${name}: ${rows[name].length} строк (всего ${kept.length + rows[name].length})`);
  }
}

// Строки 333 из data/ -> база админки. Ключи - те же, что дал бы seed (collections.js),
// включая индекс строки в файле у расписания.
async function loadIntoDb() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const filters = { routes: is333Route, route_stops: is333Route, route_geometry: is333Route, stops: is333Stop, schedule_trips: is333Trip };
  try {
    for (const name of FILES) {
      const collection = COLLECTIONS.find((c) => c.key === `ground_transport/${name}`);
      const all = read(name);
      const rows = all.map((row, index) => ({ row, index })).filter(({ row }) => filters[name](row));
      const existing = await prisma.dataRecord.findMany({ where: { collection: collection.key }, select: { id: true, payload: true } });
      const stale = existing.filter((record) => filters[name](JSON.parse(record.payload))).map((record) => record.id);
      await prisma.$transaction([
        prisma.dataRecord.deleteMany({ where: { id: { in: stale } } }),
        prisma.dataRecord.createMany({
          data: rows.map(({ row, index }) => ({
            collection: collection.key,
            recordKey: collection.keyOf(row, index),
            payload: JSON.stringify(row),
          })),
        }),
      ]);
      console.log(`[333] база ${collection.key}: удалено ${stale.length}, добавлено ${rows.length}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const mode = process.argv[2];
if (mode === '--fetch') writeData(await build());
else if (mode === '--db') await loadIntoDb();
else {
  console.error('usage: import-tram-333.mjs --fetch | --db');
  process.exit(1);
}
