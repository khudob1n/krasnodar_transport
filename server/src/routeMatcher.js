import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Направление (subrouteId), по которому едет машина. krdpt его не сообщает: у всех машин
// маршрута одни и те же концы, а direction 0/1 не совпадает с вариантами маршрута в
// data/ground_transport. Поэтому ищем геометрически: из линий направлений этого маршрута
// (route_geometry.json) берём ту, что проходит ближе всего к машине участком, идущим в ту
// же сторону, что и её курс.

const GEOMETRY_FILE = path.resolve(import.meta.dirname, '../../data/ground_transport/route_geometry.json');
// Участок «против шерсти» (курс машины расходится с ним больше чем на 100°) - как если бы
// он был на 1 км дальше: встречное направление обычно идёт по той же улице.
const WRONG_WAY_PENALTY_M = 1000;
const MAX_DISTANCE_M = 400;

const M_PER_DEG_LAT = 111_320;
let directionsByRoute = null;

function load() {
  directionsByRoute = new Map();
  if (!existsSync(GEOMETRY_FILE)) return;
  const rows = JSON.parse(readFileSync(GEOMETRY_FILE, 'utf-8'));
  for (const [index, row] of rows.entries()) {
    if (!directionsByRoute.has(row.routeId)) directionsByRoute.set(row.routeId, []);
    // index - порядок в файле: основные направления идут первыми и выигрывают при равенстве.
    directionsByRoute.get(row.routeId).push({ subrouteId: row.subrouteId, points: row.points, index });
  }
  console.log(`[routeMatcher] ${rows.length} направлений из ${GEOMETRY_FILE}`);
}

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Расстояние от машины до участка линии (метры, плоское приближение) и курс участка.
function toSegment(lat, lng, a, b, mPerDegLng) {
  const ax = (a.lng - lng) * mPerDegLng;
  const ay = (a.lat - lat) * M_PER_DEG_LAT;
  const bx = (b.lng - lng) * mPerDegLng;
  const by = (b.lat - lat) * M_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  const px = ax + t * dx;
  const py = ay + t * dy;
  const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
  return { distance: Math.hypot(px, py), bearing: (bearing + 360) % 360 };
}

export function matchSubroute(routeId, lat, lng, course) {
  if (!directionsByRoute) load();
  const directions = directionsByRoute.get(routeId);
  if (!directions) return null;

  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  let best = null;
  for (const direction of directions) {
    const { points } = direction;
    for (let i = 0; i < points.length - 1; i += 1) {
      const { distance, bearing } = toSegment(lat, lng, points[i], points[i + 1], mPerDegLng);
      if (distance > MAX_DISTANCE_M) continue;
      const score = distance + (angleDiff(bearing, course) > 100 ? WRONG_WAY_PENALTY_M : 0) + direction.index * 0.01;
      if (!best || score < best.score) best = { score, subrouteId: direction.subrouteId };
    }
  }
  return best?.subrouteId ?? null;
}
