import { Router } from 'express';
import { config } from '../lib/config.js';

// Public mirror of liveRouter for the passenger app - live vehicle positions are not
// sensitive data, no login required to see them on the map.
export const publicLiveRouter = Router();

async function fetchProxy(path, timeoutMs = 5000) {
  const res = await fetch(config.proxyUrl + path, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw Object.assign(new Error(`proxy HTTP ${res.status}`), { status: res.status });
  return res.json();
}

publicLiveRouter.get('/vehicles', async (_req, res) => {
  try {
    res.json({ vehicles: await fetchProxy('/vehicles') });
  } catch (err) {
    res.status(502).json({ error: `Прокси недоступен: ${err.message}` });
  }
});

// Балл пробок (krd-proxy берёт его у Яндекса и кэширует) - для плашки на карте.
publicLiveRouter.get('/traffic', async (_req, res) => {
  try {
    res.json(await fetchProxy('/traffic', 10000));
  } catch (err) {
    res.status(502).json({ error: `Пробки недоступны: ${err.message}` });
  }
});

publicLiveRouter.get('/rail/schedule', async (req, res) => {
  const params = new URLSearchParams();
  for (const key of ['lat', 'lng', 'date', 'transport', 'event', 'name']) {
    if (typeof req.query[key] === 'string') params.set(key, req.query[key]);
  }
  try {
    // Прокси сам ждёт Яндекс до 10 с на страницу, а у крупных вокзалов их несколько.
    res.json(await fetchProxy(`/rail/schedule?${params.toString()}`, 20000));
  } catch (err) {
    // 404 - станции нет в Яндекс Расписаниях: для пассажира это "расписания нет", а не сбой.
    if (err.status === 404) {
      res.status(404).json({ error: 'Станция не найдена в Яндекс Расписаниях' });
      return;
    }
    res.status(502).json({ error: `Расписание недоступно: ${err.message}` });
  }
});
