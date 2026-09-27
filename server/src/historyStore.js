import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config } from './config.js';

// Compact history of raw GPS fixes, one file per UTC day.
//
// Today's file is always kept as plain, appendable NDJSON (var/vehicle_history/YYYY-MM-DD.ndjson) -
// appending to a live gzip stream is risky (a crash mid-write leaves a truncated/corrupt file),
// so we only gzip a day *after* it's finished being written, at rollover / on startup.
// Rows use short keys to keep the file small - it's meant for bulk reading with a script,
// not for humans to read.
//
//   t   navTime (ISO string from the portal, e.g. "2026-09-15T17:24:56")
//   dc  deviceCode (stable per-vehicle hardware id)
//   rid route id
//   sr  subroute id (i.e. direction)
//   lat, lng
//   sp  speed
//   dir heading in degrees

mkdirSync(config.historyDir, { recursive: true });

let currentDay = null;
let currentStream = null;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function dayFilePath(day, ext = 'ndjson') {
  return path.join(config.historyDir, `${day}.${ext}`);
}

async function compressFinishedDay(day) {
  const raw = dayFilePath(day, 'ndjson');
  const gz = dayFilePath(day, 'ndjson.gz');
  if (!existsSync(raw) || existsSync(gz)) return;
  await pipeline(createReadStream(raw), createGzip(), createWriteStream(gz));
  unlinkSync(raw);
}

function pruneOldHistory() {
  const cutoff = Date.now() - config.historyRetentionDays * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(config.historyDir)) {
    const full = path.join(config.historyDir, name);
    if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
  }
}

function ensureStreamForToday() {
  const day = todayUtc();
  if (day === currentDay && currentStream) return;

  const previousDay = currentDay;
  if (currentStream) currentStream.end();
  currentDay = day;
  currentStream = createWriteStream(dayFilePath(day), { flags: 'a' });

  if (previousDay && previousDay !== day) {
    compressFinishedDay(previousDay).catch((err) => console.error('[history] compress failed:', err));
  }
  // Catch up on any older uncompressed days too (e.g. after the process was down for a while).
  for (const name of readdirSync(config.historyDir)) {
    if (name.endsWith('.ndjson') && !name.startsWith(day)) {
      compressFinishedDay(name.replace('.ndjson', '')).catch((err) => console.error('[history] compress failed:', err));
    }
  }
  pruneOldHistory();
}

export function appendFix(vehicle) {
  ensureStreamForToday();
  const row = {
    t: vehicle.navTime,
    dc: vehicle.deviceCode,
    rid: vehicle.routeId,
    sr: vehicle.subrouteId,
    lat: vehicle.lat,
    lng: vehicle.lng,
    sp: vehicle.speed,
    dir: vehicle.dir,
  };
  currentStream.write(JSON.stringify(row) + '\n');
}

export function closeHistoryStore() {
  return new Promise((resolve) => {
    if (!currentStream) return resolve();
    currentStream.end(resolve);
  });
}
