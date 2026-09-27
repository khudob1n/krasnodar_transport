import { fetchVehicleSnapshot } from './upstreamClient.js';
import { appendFix } from './historyStore.js';

// deviceCode -> cleaned vehicle object (latest known fix)
const latestByDevice = new Map();

function cleanVehicle(raw) {
  return {
    deviceCode: raw.deviceCode,
    gosNum: raw.gosNum,
    routeId: raw.rid,
    subrouteId: raw.srid,
    routeType: raw.rtype, // "А" / "Тм" / "Тб"
    routeNumber: raw.rnum,
    lat: raw.lat,
    lng: raw.lng,
    speed: raw.speed,
    dir: raw.dir,
    navTime: raw.navTime,
    lowFloor: raw.lowFloor,
    model: raw.model,
    operator: raw.operator,
    boardNumber: raw.boardNumber,
    from: raw.from,
    to: raw.to,
  };
}

export function getSnapshot() {
  return Array.from(latestByDevice.values());
}

export async function pollOnce({ onUpdate, onError }) {
  let anims;
  try {
    anims = await fetchVehicleSnapshot();
  } catch (err) {
    onError?.(err);
    return;
  }

  const changed = [];
  for (const raw of anims) {
    const prev = latestByDevice.get(raw.deviceCode);
    if (prev && prev.navTime === raw.navTime) continue; // no new GPS fix since last poll

    const vehicle = cleanVehicle(raw);
    latestByDevice.set(raw.deviceCode, vehicle);
    changed.push(vehicle);
    appendFix(vehicle);
  }

  if (changed.length > 0) onUpdate?.(changed);
}

export function startPolling(intervalMs, handlers) {
  pollOnce(handlers); // don't wait for the first interval tick
  const timer = setInterval(() => pollOnce(handlers), intervalMs);
  return () => clearInterval(timer);
}
