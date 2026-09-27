// Балл пробок в Краснодаре - из информера Яндекса (export.yandex.ru/bar/reginfo.xml,
// регион 35). Это не официальный API: формат могут поменять или закрыть - тогда отдаём
// 502, а плашка на карте просто прячется. Браузер к информеру напрямую не пускают (нет CORS),
// поэтому ходим отсюда и кэшируем: данные у Яндекса обновляются раз в несколько минут.

const URL = 'https://export.yandex.ru/bar/reginfo.xml?region=35';
const CACHE_TTL_MS = 2 * 60 * 1000;

let cache = null;
let inFlight = null;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const tag = (xml, name) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? null;

function parse(xml) {
  const block = xml.match(/<traffic[^>]*>([\s\S]*?)<\/traffic>/)?.[1];
  const level = block ? Number(tag(block, 'level')) : NaN;
  if (!block || !Number.isFinite(level)) throw new Error('В ответе Яндекса нет уровня пробок');
  const timestamp = Number(tag(block, 'timestamp'));
  return {
    // 0-10, как баллы на Яндекс Картах.
    level,
    // green / yellow / red - цвет, которым Яндекс сам показывает этот балл.
    color: tag(block, 'icon'),
    hint: block.match(/<hint lang="ru">([^<]*)<\/hint>/)?.[1] ?? null,
    // -1 - пробки уменьшаются, 1 - растут, 0 - без изменений.
    trend: Number(tag(block, 'tend')) || 0,
    updatedAt: Number.isFinite(timestamp) ? new Date(timestamp * 1000).toISOString() : null,
    url: tag(block, 'url'),
  };
}

async function load() {
  const response = await fetch(URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (krasnodar-transport)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Яндекс ответил ${response.status}`);
  return parse(await response.text());
}

export async function handleTraffic(_req, res) {
  try {
    if (!cache || cache.expiresAt <= Date.now()) {
      inFlight ??= load().finally(() => {
        inFlight = null;
      });
      cache = { value: await inFlight, expiresAt: Date.now() + CACHE_TTL_MS };
    }
    sendJson(res, 200, cache.value);
  } catch (error) {
    // Отдаём прошлое значение, если оно есть: пара минут старины лучше пустой плашки.
    if (cache) {
      sendJson(res, 200, cache.value);
      return;
    }
    sendJson(res, 502, { error: `Пробки недоступны: ${error.message}` });
  }
}
