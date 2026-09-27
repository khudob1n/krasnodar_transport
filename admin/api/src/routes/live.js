import { Router } from 'express';
import { config } from '../lib/config.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const liveRouter = Router();
liveRouter.use(requireAuth);

async function fetchProxy(path) {
  const res = await fetch(config.proxyUrl + path, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  return res.json();
}

liveRouter.get('/health', async (_req, res) => {
  try {
    res.json(await fetchProxy('/health'));
  } catch (err) {
    res.status(502).json({ error: `Прокси недоступен: ${err.message}` });
  }
});

liveRouter.get('/vehicles', async (_req, res) => {
  try {
    res.json({ vehicles: await fetchProxy('/vehicles') });
  } catch (err) {
    res.status(502).json({ error: `Прокси недоступен: ${err.message}` });
  }
});
