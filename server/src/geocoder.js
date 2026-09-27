import { readFileSync } from 'node:fs';
import path from 'node:path';

// Свой геокодер по индексу из OSM (data/geocoder/places.json, собирает
// deploy/geocoder/update-geocoder.sh): публичный Photon отвечает по 2-3 секунды, а по
// индексу в памяти поиск - единицы миллисекунд. Индекс ~75 тыс. строк: дома, заведения,
// улицы, районы Краснодара с пригородами.

const PLACES_FILE = path.resolve(import.meta.dirname, '../../data/geocoder/places.json');
const LIMIT = 6;
const CENTER = { lat: 45.0355, lng: 38.9753 };

// Слова, без которых адрес тот же: «Красная 122» = «г. Краснодар, д. Красная 122».
const GENERIC = new Set(['дом', 'д', 'г', 'город', 'краснодар', 'крд']);

// Тип улицы в поиске необязателен («Малышева 36» найдёт улицу Малышева), но если указан -
// поднимает её: «проспект Ленина 24а» - это проспект, а не улица Ленина.
const STREET_TYPES = new Map(
  Object.entries({
    улица: ['улица', 'ул'],
    проспект: ['проспект', 'пр', 'пр-т', 'пркт'],
    переулок: ['переулок', 'пер'],
    бульвар: ['бульвар', 'б-р', 'бул'],
    площадь: ['площадь', 'пл'],
    шоссе: ['шоссе', 'ш'],
    набережная: ['набережная', 'наб'],
    тракт: ['тракт'],
    проезд: ['проезд', 'пр-д'],
    тупик: ['тупик'],
  }).flatMap(([type, forms]) => forms.map((form) => [form, type])),
);

/** Слова названия без типа улицы и служебных слов + тип улицы отдельно. */
function parse(text) {
  const all = text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'(),.;:№#]/g, ' ')
    // «36а», «36 а», «36-а» -> «36а»; «24/8» остаётся одним словом.
    .replace(/(\d)\s*-?\s*([а-я])(?![а-я])/g, '$1$2')
    .split(/\s+/)
    .filter((word) => word && !GENERIC.has(word));
  return {
    words: all.filter((word) => !STREET_TYPES.has(word)),
    type: all.map((word) => STREET_TYPES.get(word)).find(Boolean),
  };
}

const isNumber = (word) => /^\d/.test(word);

// kind: a - дом, p - заведение, s - улица, l - район.
let places = null;

function load() {
  if (places) return places;
  try {
    const { rows } = JSON.parse(readFileSync(PLACES_FILE, 'utf-8'));
    places = rows.map(([kind, title, subtitle, lat, lng]) => {
      const { words, type } = parse(title);
      // У дома номер - последнее слово адреса («улица 8 Марта, 12» - дом 12, «8» - часть улицы).
      const house = kind === 'a' && isNumber(words[words.length - 1]);
      return {
        kind,
        title,
        subtitle,
        lat,
        lng,
        number: house ? words[words.length - 1] : undefined,
        words: house ? words.slice(0, -1) : words,
        type,
      };
    });
    console.log(`[geocoder] ${places.length} мест из ${PLACES_FILE}`);
  } catch (error) {
    console.error('[geocoder] индекс не загружен:', error.message);
    places = [];
  }
  return places;
}

const distance2 = (a, b) => (a.lat - b.lat) ** 2 + ((a.lng - b.lng) * 0.55) ** 2;

/** Каждое слово запроса - начало какого-то слова места. Сколько совпало целиком - в плюс. */
function matchWords(queryWords, placeWords) {
  let exact = 0;
  for (const word of queryWords) {
    const hit = placeWords.find((candidate) => candidate.startsWith(word));
    if (!hit) return -1;
    if (hit === word) exact += 1;
  }
  return exact;
}

export function search(query) {
  const { words, type } = parse(query);
  if (!words.length || query.trim().length < 2) return [];
  // «Малышева 36», «8 Марта 12»: последнее число после названия - номер дома, остальное -
  // название улицы. Без номера дома не показываем: их на улице сотни, вместо них - улица.
  const last = words[words.length - 1];
  const houseNumber = words.length > 1 && isNumber(last) ? last : null;
  const names = houseNumber ? words.slice(0, -1) : words;

  const found = [];
  for (const place of load()) {
    let score;
    if (place.kind === 'a') {
      if (!houseNumber || !place.number?.startsWith(houseNumber)) continue;
      const exact = matchWords(names, place.words);
      if (exact < 0) continue;
      score = 100 + exact * 10 + (place.number === houseNumber ? 20 : 0);
    } else {
      // У заведений и улиц число - часть названия: «школа 36», «8 Марта».
      const exact = matchWords(words, place.words);
      if (exact < 0) continue;
      score = { s: 60, l: 50, p: 40 }[place.kind] + exact * 10;
      // Название совпало целиком, без лишних слов.
      if (exact === words.length && place.words.length === words.length) score += 10;
    }
    if (type && place.type === type) score += 15;
    // Краснодар (без подписи города) - выше одноимённых улиц пригородов (Яблоновский и т.п.).
    if (!place.subtitle || place.kind === 'p') score += 3;
    found.push({ place, score });
  }

  found.sort(
    (a, b) =>
      b.score - a.score ||
      // При равенстве - ближе к центру: там ищут чаще, чем в пригородах.
      distance2(a.place, CENTER) - distance2(b.place, CENTER) ||
      a.place.title.length - b.place.title.length,
  );
  // «Улица Малышева» и «улица Малышева» в OSM - одна улица.
  const seen = new Set();
  const unique = found.filter(({ place }) => {
    const key = `${place.kind}|${place.title.toLowerCase()}|${place.subtitle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, LIMIT).map(({ place }) => ({
    title: place.title,
    subtitle: place.subtitle || { a: 'Адрес', s: 'Улица', l: 'Район', p: '' }[place.kind],
    lat: place.lat,
    lng: place.lng,
  }));
}

/** Подпись точки на карте: дом рядом, иначе заведение, иначе улица. */
export function reverse(lat, lng) {
  const point = { lat, lng };
  // Пороги в квадратах «градусов» с поправкой на широту: ~60 м, ~40 м, ~150 м.
  const limits = { a: (60 / 111000) ** 2, p: (40 / 111000) ** 2, s: (150 / 111000) ** 2 };
  const best = {};
  for (const place of load()) {
    const limit = limits[place.kind];
    if (!limit) continue;
    const d = distance2(place, point);
    if (d < limit && (!best[place.kind] || d < best[place.kind].d)) best[place.kind] = { d, place };
  }
  const hit = best.a ?? best.p ?? best.s;
  return hit ? { title: hit.place.title, subtitle: hit.place.subtitle } : null;
}

export function handleGeocode(req, res, url) {
  const send = (status, body) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/geocode/reverse') {
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return send(400, { error: 'lat, lng' });
    return send(200, { place: reverse(lat, lng) });
  }
  const query = (url.searchParams.get('q') ?? '').slice(0, 100);
  return send(200, { places: search(query) });
}

// Индекс грузится при старте, а не на первом запросе - чтобы первый пассажир не ждал.
load();
