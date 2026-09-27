import { Router } from 'express';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import readline from 'node:readline';
import path from 'node:path';
import { requireAuth } from '../middleware/requireAuth.js';
import { HISTORY_DIR } from '../lib/paths.js';

export const historyRouter = Router();
historyRouter.use(requireAuth);

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

historyRouter.get('/days', (_req, res) => {
  if (!existsSync(HISTORY_DIR)) return res.json({ days: [] });

  const byDay = new Map();
  for (const name of readdirSync(HISTORY_DIR)) {
    const isGz = name.endsWith('.ndjson.gz');
    const isRaw = name.endsWith('.ndjson') && !isGz;
    if (!isGz && !isRaw) continue;
    const day = name.replace(/\.ndjson(\.gz)?$/, '');
    if (!DAY_RE.test(day)) continue;
    const full = path.join(HISTORY_DIR, name);
    byDay.set(day, { day, compressed: isGz, sizeBytes: statSync(full).size });
  }

  const days = Array.from(byDay.values()).sort((a, b) => b.day.localeCompare(a.day));
  res.json({ days });
});

historyRouter.get('/:day', async (req, res) => {
  const { day } = req.params;
  if (!DAY_RE.test(day)) return res.status(400).json({ error: 'Ожидается дата в формате YYYY-MM-DD' });

  const rawPath = path.join(HISTORY_DIR, `${day}.ndjson`);
  const gzPath = path.join(HISTORY_DIR, `${day}.ndjson.gz`);
  let filePath, compressed;
  if (existsSync(rawPath)) {
    filePath = rawPath;
    compressed = false;
  } else if (existsSync(gzPath)) {
    filePath = gzPath;
    compressed = true;
  } else {
    return res.status(404).json({ error: 'Нет истории за этот день' });
  }

  const deviceCode = req.query.deviceCode ? String(req.query.deviceCode) : null;
  const routeId = req.query.routeId ? Number(req.query.routeId) : null;
  const limit = Math.min(Number(req.query.limit) || 500, 5000);

  const rows = [];
  let matched = 0;
  const stream = createReadStream(filePath);
  const source = compressed ? stream.pipe(createGunzip()) : stream;
  const rl = readline.createInterface({ input: source, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (deviceCode && row.dc !== deviceCode) continue;
    if (routeId != null && row.rid !== routeId) continue;
    matched += 1;
    if (rows.length < limit) rows.push(row);
  }

  res.json({ day, compressed, matched, returned: rows.length, limit, rows });
});
