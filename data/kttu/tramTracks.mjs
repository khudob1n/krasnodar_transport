// Линии трамвайных маршрутов по путям из OpenStreetMap. У КТТУ геометрии нет, а трамвай ездит
// только по рельсам, поэтому линия направления - кратчайший путь по графу путей между каждой
// парой соседних остановок. Пути (railway=tram в рамке города) лежат в data/kttu/osm-tram.json:
//
//   curl https://overpass.private.coffee/api/interpreter --data-urlencode \
//     'data=[out:json];way["railway"="tram"](44.95,38.80,45.20,39.25);(._;>;);out skel qt;' \
//     -o data/kttu/osm-tram.json

import { readFileSync } from 'node:fs';

const MAX_SNAP_M = 150;
// Двухпутная линия в OSM - два отдельных пути, соединённых только на концах. Остановка может
// привязаться к рельсу встречного направления, и кратчайший путь ушёл бы через разворотную
// петлю за километры. Поэтому соседние рельсы (ближе CROSSOVER_M) связаны переходом со
// штрафом: на рисунке линии это незаметно, а объезды пропадают.
const CROSSOVER_M = 15;
const CROSSOVER_PENALTY_M = 40;
const M_PER_DEG = 111_320;

function metres(a, b) {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat) * M_PER_DEG, (a.lng - b.lng) * M_PER_DEG * k);
}

export function loadTramTracks(file) {
  const { elements } = JSON.parse(readFileSync(file, 'utf-8'));
  const nodes = new Map();
  for (const e of elements) if (e.type === 'node') nodes.set(e.id, { lat: e.lat, lng: e.lon });
  const edges = new Map();
  const link = (a, b, extra = 0) => {
    const w = metres(nodes.get(a), nodes.get(b)) + extra;
    if (!edges.has(a)) edges.set(a, []);
    if (!edges.has(b)) edges.set(b, []);
    edges.get(a).push([b, w]);
    edges.get(b).push([a, w]);
  };
  for (const e of elements) {
    if (e.type !== 'way') continue;
    for (let i = 1; i < e.nodes.length; i++) {
      if (nodes.has(e.nodes[i - 1]) && nodes.has(e.nodes[i])) link(e.nodes[i - 1], e.nodes[i]);
    }
  }
  const ids = [...edges.keys()];

  // Переходы между соседними рельсами: узлы, отсортированные по широте, сравниваем только с
  // теми, что рядом по широте.
  const byLat = ids.map((id) => [id, nodes.get(id)]).sort((a, b) => a[1].lat - b[1].lat);
  const maxDLat = CROSSOVER_M / M_PER_DEG;
  for (let i = 0; i < byLat.length; i++) {
    const [a, pa] = byLat[i];
    const neighbours = new Set(edges.get(a).map(([id]) => id));
    for (let j = i + 1; j < byLat.length && byLat[j][1].lat - pa.lat <= maxDLat; j++) {
      const [b, pb] = byLat[j];
      if (!neighbours.has(b) && metres(pa, pb) <= CROSSOVER_M) link(a, b, CROSSOVER_PENALTY_M);
    }
  }

  function nearest(point) {
    let best = null;
    let bestDist = Infinity;
    for (const id of ids) {
      const d = metres(point, nodes.get(id));
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    return bestDist <= MAX_SNAP_M ? best : null;
  }

  // Дейкстра с ранней остановкой; граф маленький (несколько тысяч узлов), поэтому очередь -
  // простой массив.
  function shortestPath(from, to) {
    if (from === to) return [from];
    const dist = new Map([[from, 0]]);
    const prev = new Map();
    const queue = [[0, from]];
    const done = new Set();
    while (queue.length) {
      let min = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i][0] < queue[min][0]) min = i;
      const [d, id] = queue.splice(min, 1)[0];
      if (done.has(id)) continue;
      done.add(id);
      if (id === to) break;
      for (const [next, w] of edges.get(id) || []) {
        const nd = d + w;
        if (nd < (dist.get(next) ?? Infinity)) {
          dist.set(next, nd);
          prev.set(next, id);
          queue.push([nd, next]);
        }
      }
    }
    if (!done.has(to)) return null;
    const path = [to];
    while (path[0] !== from) path.unshift(prev.get(path[0]));
    return path;
  }

  /** Линия через все остановки направления по рельсам или null, если остановку не к чему привязать. */
  return function tramLine(stations) {
    const snapped = stations.map(nearest);
    if (snapped.some((id) => id === null)) return null;
    const line = [];
    for (let i = 1; i < snapped.length; i++) {
      const path = shortestPath(snapped[i - 1], snapped[i]);
      if (!path) return null;
      for (const id of line.length ? path.slice(1) : path) line.push(nodes.get(id));
    }
    return line;
  };
}
