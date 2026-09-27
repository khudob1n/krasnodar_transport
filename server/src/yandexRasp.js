import { config } from "./config.js";

const cache = new Map();
// Запросы, которые уже летят в Яндекс: второй такой же запрос (две вкладки, быстрые
// переключения дня туда-обратно) ждёт первый, а не отправляет свой.
const inFlight = new Map();

// Станции не переезжают - найденную по координатам держим сутки, а не как расписание.
const STATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Отдельная метка «станции нет», чтобы и отрицательный ответ кэшировался: getCached
// возвращает null для отсутствующего ключа.
const NOT_FOUND = Symbol("not-found");

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function getCached(key) {
  const item = cache.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value, ttlMs = config.yandexRasp.cacheTtlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function cached(key, ttlMs, load) {
  const hit = getCached(key);
  if (hit) return hit;
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = load()
    .then((value) => setCached(key, value, ttlMs))
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function requestYandex(path, params) {
  const url = new URL(`${config.yandexRasp.baseUrl}/${path}/`);
  url.search = new URLSearchParams({
    apikey: config.yandexRasp.apiKey,
    format: "json",
    lang: "ru_RU",
    ...params,
  });

  const response = await fetch(url, {
    signal: AbortSignal.timeout(config.yandexRasp.timeoutMs),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error?.text || payload?.error || `HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return payload;
}

// Яндекс сокращает названия станций ("Ростов-Гл.", "Новоросс."). Сокращения одних и тех же
// станций повторяются, поэтому расшифровываем их по словарю.
const STATION_ABBREVIATIONS = [
  [/^Ростов-Гл\.?$/, "Ростов-Главный"],
  [/^Новоросс\.?$/, "Новороссийск"],
];

// "Верх. Уфалей", "Верх. Пышма", "Нижн. Салда": прилагательное согласуем по окончанию
// следующего слова - Верхний Уфалей, Верхняя Пышма, Верхнее Дуброво.
const ADJECTIVE_ABBREVIATION = /^(Верх|Нижн?)\.\s*(\S+)/;

function expandAdjective(stem, noun) {
  const base = stem === "Верх" ? "Верхн" : "Нижн";
  if (/[ая]$/.test(noun)) return `${base}яя`;
  if (/[ое]$/.test(noun)) return `${base}ее`;
  return `${base}ий`;
}

function expandStationName(name) {
  const trimmed = name.trim();
  for (const [pattern, replacement] of STATION_ABBREVIATIONS) {
    if (pattern.test(trimmed)) return replacement;
  }
  return trimmed.replace(
    ADJECTIVE_ABBREVIATION,
    (_, stem, noun) => `${expandAdjective(stem, noun)} ${noun}`,
  );
}

function expandThreadTitle(title) {
  return title
    .split(" — ")
    .map(expandStationName)
    .join(" — ");
}

const normalizeName = (name) =>
  expandStationName(name).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]/g, "");

// Координаты наших станций и Яндекса расходятся, а платформы в городе стоят плотно:
// ближайшей к точке "Шарташ" оказывается "Синие Камни", к "Компрессорному заводу" -
// "Лечебный". Поэтому в радиусе 3 км ищем станцию с тем же названием и только если её
// нет, берём ближайшую в пределах километра.
function pickStation(stations, name) {
  const wanted = name ? normalizeName(name) : "";
  if (wanted) {
    // Сначала точное совпадение: рядом с "Шувакишем" есть ещё и "Шувакиш Тур".
    const titles = stations.map((station) => normalizeName(station.title));
    const exact = titles.indexOf(wanted);
    if (exact !== -1) return stations[exact];
    const partial = titles.findIndex(
      (title) => title.startsWith(wanted) || wanted.startsWith(title),
    );
    if (partial !== -1) return stations[partial];
  }
  const nearest = stations[0];
  return nearest && nearest.distance <= 1 ? nearest : null;
}

async function resolveStation(lat, lng, transportType, name) {
  const cacheKey = `nearest:${transportType}:${lat.toFixed(4)}:${lng.toFixed(4)}:${name}`;
  const station = await cached(cacheKey, STATION_CACHE_TTL_MS, async () => {
    const payload = await requestYandex("nearest_stations", {
      lat: String(lat),
      lng: String(lng),
      distance: "3",
      transport_types:
        transportType === "bus"
          ? "bus"
          : transportType === "plane"
            ? "plane"
            : "train",
      limit: "20",
    });
    return pickStation(payload.stations || [], name) || NOT_FOUND;
  });
  return station === NOT_FOUND ? null : station;
}

function stationUrl(code, date, event) {
  const url = new URL(`https://rasp.yandex.ru/station/${code.replace(/^s/, "")}/`);
  url.searchParams.set("date", date);
  if (event === "arrival") url.searchParams.set("event", "arrival");
  return url.toString();
}

function normalizeEvent(item) {
  return {
    number: item.thread?.number || "",
    // Полный title, а не short_title: в коротком Яндекс режет названия станций.
    title: expandThreadTitle(item.thread?.title || item.thread?.short_title || ""),
    transportType: item.thread?.transport_type || "",
    carrier: item.thread?.carrier?.title || "",
    // IATA-код перевозчика - по нему клиент подбирает логотип авиакомпании.
    carrierCode: item.thread?.carrier?.codes?.iata || "",
    departure: item.departure || null,
    arrival: item.arrival || null,
    platform: item.platform || "",
    // Для части рейсов терминал приходит строкой "NULL".
    terminal: item.terminal && item.terminal !== "NULL" ? item.terminal : "",
  };
}

async function fetchSchedule(station, date, transportTypes, event) {
  const params = {
    station,
    date,
    transport_types: transportTypes,
    event,
    limit: "100",
  };
  const firstPage = await requestYandex("schedule", params);
  const total = firstPage.pagination?.total || firstPage.schedule?.length || 0;
  const pageCount = Math.ceil(total / 100);
  if (pageCount <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      requestYandex("schedule", {
        ...params,
        offset: String((index + 1) * 100),
      }),
    ),
  );
  return {
    ...firstPage,
    schedule: [firstPage, ...remainingPages].flatMap(
      (page) => page.schedule || [],
    ),
  };
}

export async function handleRailSchedule(req, res, url) {
  if (!config.yandexRasp.apiKey) {
    sendJson(res, 503, { error: "Ключ API Яндекс Расписаний не настроен" });
    return;
  }

  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const requestedTransport = url.searchParams.get("transport");
  const transportType = ["bus", "plane"].includes(requestedTransport)
    ? requestedTransport
    : "rail";
  const event =
    url.searchParams.get("event") === "arrival" ? "arrival" : "departure";
  // Без даты - сегодня по Краснодару (МСК), а не по UTC: иначе с 00:00 до 03:00 - вчера.
  const date =
    url.searchParams.get("date") ||
    new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  const name = (url.searchParams.get("name") || "").slice(0, 100);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    sendJson(res, 400, { error: "Нужны корректные параметры lat и lng" });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    sendJson(res, 400, { error: "Дата должна быть в формате YYYY-MM-DD" });
    return;
  }

  try {
    const station = await resolveStation(lat, lng, transportType, name);
    if (!station) {
      sendJson(res, 404, { error: "Станция не найдена в Яндекс Расписаниях" });
      return;
    }

    const cacheKey = `schedule:${transportType}:${event}:${station.code}:${date}`;
    const payload = await cached(cacheKey, config.yandexRasp.cacheTtlMs, () =>
      fetchSchedule(
        station.code,
        date,
        transportType === "bus"
          ? "bus"
          : transportType === "plane"
            ? "plane"
            : "train,suburban",
        event,
      ),
    );

    sendJson(res, 200, {
      date,
      station: {
        code: payload.station?.code || station.code,
        title: expandStationName(payload.station?.title || station.title),
        type: payload.station?.station_type || station.station_type,
      },
      departures: (payload.schedule || []).map(normalizeEvent),
      total: payload.pagination?.total || 0,
      source: {
        title: "Яндекс Расписания",
        url: stationUrl(payload.station?.code || station.code, date, event),
      },
    });
  } catch (error) {
    console.error("[yandex-rasp]", error.message);
    sendJson(res, 502, { error: "Не удалось получить расписание" });
  }
}
