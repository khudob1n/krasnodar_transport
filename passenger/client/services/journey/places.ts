/**
 * Точки маршрута «от двери до двери»: кроме остановки (id) откуда и куда может быть любое
 * место - адрес, точка на карте, местоположение пассажира. Такое место в состоянии и в ссылке
 * хранится строкой «широта,долгота»: с id остановки не спутать, в адресной строке читается.
 *
 * Здесь же бесплатные сервисы:
 *  - пешие маршруты - свой OSRM с профилем foot (deploy/osrm), в браузер отдаётся по /api/walk/;
 *  - адреса - свой геокодер по индексу OSM (/api/geocode, deploy/geocoder), запасной -
 *    публичный Photon (photon.komoot.io).
 */

export interface LatLngPoint {
    lat: number;
    lng: number;
}

const POINT_RE = /^(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)$/;

export const pointValue = ({ lat, lng }: LatLngPoint) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

export function parsePoint(value: string | null | undefined): LatLngPoint | null {
    const match = value?.match(POINT_RE);
    return match ? { lat: Number(match[1]), lng: Number(match[2]) } : null;
}

export const isPointValue = (value: string | null | undefined) => parsePoint(value) !== null;

/** Краснодар с пригородами - та же рамка, по которой собран OSRM. */
const BBOX = { west: 38.8, south: 44.95, east: 39.25, north: 45.2 };
const CITY_CENTER = { lat: 45.0355, lng: 38.9753 };

export const insideCity = ({ lat, lng }: LatLngPoint) =>
    lat > BBOX.south && lat < BBOX.north && lng > BBOX.west && lng < BBOX.east;

// ---------- OSRM ----------

const WALK_API = '/api/walk';
/** OSRM не ответил за это время - считаем по прямой, поиск маршрута не ждёт. */
const WALK_TIMEOUT_MS = 4000;

function fetchWalk(path: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WALK_TIMEOUT_MS);
    return fetch(`${WALK_API}/${path}`, { signal: controller.signal }).finally(() =>
        clearTimeout(timer),
    );
}

export interface WalkRoute {
    meters: number;
    /** [lat, lng] - как у Leaflet. */
    positions: [number, number][];
}

const coords = (points: LatLngPoint[]) =>
    points.map((point) => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`).join(';');

const routeCache = new Map<string, Promise<WalkRoute | null>>();

/** Пеший путь по улицам. null - OSRM недоступен или пути нет (тогда рисуем прямую). */
export function fetchWalkRoute(from: LatLngPoint, to: LatLngPoint): Promise<WalkRoute | null> {
    const key = coords([from, to]);
    let cached = routeCache.get(key);
    if (!cached) {
        cached = fetchWalk(`route/v1/foot/${key}?overview=full&geometries=geojson`)
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                const route = data?.routes?.[0];
                if (!route) return null;
                return {
                    meters: route.distance as number,
                    positions: (route.geometry.coordinates as [number, number][]).map(
                        ([lng, lat]) => [lat, lng] as [number, number],
                    ),
                };
            })
            .catch(() => null);
        // Ошибку не кешируем - в следующий раз попробуем снова.
        cached.then((result) => result === null && routeCache.delete(key));
        routeCache.set(key, cached);
    }
    return cached;
}

/**
 * Пешие расстояния от одной точки до многих (или от многих до одной, reverse) одним запросом.
 * null - OSRM недоступен; в массиве null - до этой точки пути нет.
 */
export async function fetchWalkDistances(
    point: LatLngPoint,
    targets: LatLngPoint[],
    reverse = false,
): Promise<(number | null)[] | null> {
    if (!targets.length) return [];
    const all = [point, ...targets];
    const others = targets.map((_, index) => index + 1).join(';');
    const params = reverse
        ? `sources=${others}&destinations=0`
        : `sources=0&destinations=${others}`;
    try {
        const response = await fetchWalk(
            `table/v1/foot/${coords(all)}?${params}&annotations=distance`,
        );
        if (!response.ok) return null;
        const data = await response.json();
        if (data.code !== 'Ok') return null;
        const rows: (number | null)[][] = data.distances;
        return reverse ? rows.map((row) => row[0]) : rows[0];
    } catch {
        return null;
    }
}

// ---------- Геокодер ----------

export interface Place extends LatLngPoint {
    title: string;
    subtitle: string;
}

interface PhotonFeature {
    geometry: { coordinates: [number, number] };
    properties: Record<string, string | undefined>;
}

// Почтовый индекс приходит отдельным объектом с индексом вместо названия - как место он бесполезен.
const isUseful = ({ properties: p }: PhotonFeature) =>
    p.type !== 'postcode' && p.osm_value !== 'postcode' && Boolean(p.name || p.street);

function describe({ properties: p, geometry }: PhotonFeature): Place {
    const address = [p.street, p.housenumber].filter(Boolean).join(', ');
    const title = p.name || address || p.locality || p.district || p.city || 'Место на карте';
    const area = p.city && p.city !== 'Краснодар' ? p.city : p.district || p.locality || '';
    const subtitle = [p.name && address ? address : '', area].filter(Boolean).join(' · ');
    const [lng, lat] = geometry.coordinates;
    return { lat, lng, title, subtitle };
}

const PHOTON = 'https://photon.komoot.io';

// Свой геокодер (server/src/geocoder.js) - индекс OSM в памяти, отвечает за миллисекунды.
// Photon - запасной: если своего нет или он ничего не нашёл (редкий адрес, опечатка).
const GEOCODE_API = '/api/geocode';
const GEOCODE_TIMEOUT_MS = 2500;

async function fetchOwn<T>(path: string, signal?: AbortSignal): Promise<T | null> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    const timer = setTimeout(abort, GEOCODE_TIMEOUT_MS);
    try {
        const response = await fetch(`${GEOCODE_API}${path}`, { signal: controller.signal });
        return response.ok ? ((await response.json()) as T) : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
    const own = await fetchOwn<{ places: Place[] }>(`?q=${encodeURIComponent(query)}`, signal);
    if (own?.places.length) return own.places;
    if (signal?.aborted) return [];
    return searchPhoton(query, signal);
}

async function searchPhoton(query: string, signal?: AbortSignal): Promise<Place[]> {
    const params = new URLSearchParams({
        q: query,
        limit: '6',
        lat: String(CITY_CENTER.lat),
        lon: String(CITY_CENTER.lng),
        bbox: `${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`,
        // Без этого Photon отвечает на языке браузера: «Frunze Street» вместо «улица Фрунзе».
        lang: 'default',
    });
    const response = await fetch(`${PHOTON}/api/?${params}`, { signal });
    if (!response.ok) return [];
    const data = await response.json();
    const places = (data.features as PhotonFeature[]).filter(isUseful).map(describe);
    // Одно и то же здание приходит и как адрес, и как организация в нём.
    return places.filter(
        (place, index) =>
            places.findIndex(
                (other) =>
                    `${other.title}|${other.subtitle}` === `${place.title}|${place.subtitle}`,
            ) === index,
    );
}

/** Подпись для точки на карте: ближайший адрес или объект. */
export async function describePoint(point: LatLngPoint): Promise<string | null> {
    const own = await fetchOwn<{ place: { title: string } | null }>(
        `/reverse?lat=${point.lat.toFixed(6)}&lng=${point.lng.toFixed(6)}`,
    );
    if (own?.place) return own.place.title;
    try {
        const response = await fetch(
            `${PHOTON}/reverse?lat=${point.lat.toFixed(6)}&lon=${point.lng.toFixed(6)}&limit=5&radius=0.15&lang=default`,
        );
        if (!response.ok) return null;
        const data = await response.json();
        const feature = (data.features as PhotonFeature[]).find(isUseful);
        return feature ? describe(feature).title : null;
    } catch {
        return null;
    }
}
