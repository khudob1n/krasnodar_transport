import { ADMIN_API_URL } from 'transport-common/strapi/constants';

// Тонкая обвязка над нашим admin/api (server/+data/ поверх него) - единственное, что
// реально подключает этот каркас к данным: admin/api/src/routes/publicCollections.js
// (справочные датасеты, те же, что видит админка) и .../publicLive.js (текущие позиции
// транспорта, снимок server/src/poller.js).
interface RecordsResponse<T> {
    records: { data: T }[];
    total: number;
}

async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${ADMIN_API_URL}${path}`);
    if (!res.ok) throw new Error(`admin/api ${path} -> HTTP ${res.status}`);
    return res.json();
}

export async function fetchAllRecords<T>(collection: string): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    for (;;) {
        const res = await getJson<RecordsResponse<T>>(
            `/api/app/collections/${collection}/records?page=${page}&pageSize=500`,
        );

        // Страница без единой записи означает "дальше данных нет", даже если total обещал
        // больше (запись удалили между двумя запросами, total и выборка на бэке не в одной
        // транзакции - см. admin/api/src/lib/collectionsQuery.js) - без этой проверки
        // "all.length >= res.total" никогда не выполняется, и цикл долбит API бесконечно.
        if (res.records.length === 0) break;

        all.push(...res.records.map((r) => r.data));
        if (all.length >= res.total) break;
        page += 1;
    }
    return all;
}

// Справочники карты (станции, входы, депо, остановки) нужны сразу нескольким местам: слою
// на основной карте, мини-карте в настройках, поиску. Без общего кэша каждое место грузило
// их заново. Храним промис, чтобы и одновременные запросы шли одним; отказ не кэшируем.
// Только для клиента: на сервере Next модульный кэш пережил бы правки в админке.
const collectionCache = new Map<string, Promise<unknown[]>>();

export function loadCollection<T>(collection: string): Promise<T[]> {
    const cached = collectionCache.get(collection);
    if (cached) return cached as Promise<T[]>;

    const promise = fetchAllRecords<T>(collection);
    collectionCache.set(collection, promise);
    promise.catch(() => collectionCache.delete(collection));
    return promise;
}

export async function fetchByFilter<T>(
    collection: string,
    filters: Record<string, string | number>,
): Promise<T[]> {
    // API отдаёт не больше 500 записей за раз, а у крупных остановок рейсов больше
    // (у "1833" в будни 615) - без догрузки страниц хвост расписания терялся.
    const all: T[] = [];
    for (let page = 1; ; page += 1) {
        const params = new URLSearchParams({
            filters: JSON.stringify(filters),
            pageSize: '500',
            page: String(page),
        });
        const res = await getJson<RecordsResponse<T>>(
            `/api/app/collections/${collection}/records?${params.toString()}`,
        );
        if (res.records.length === 0) break;
        all.push(...res.records.map((r) => r.data));
        if (all.length >= res.total) break;
    }
    return all;
}

export async function fetchOneByFilter<T>(
    collection: string,
    filters: Record<string, string | number>,
): Promise<T | null> {
    const records = await fetchByFilter<T>(collection, filters);
    return records[0] ?? null;
}

export interface StopScheduleTrip {
    route_number: string;
    route_type: string;
    day_type: string;
    time: string;
    to_station: string;
}

export interface StopScheduleInterval {
    route_number: string;
    route_type: string;
    day_type: string;
    start_time: string;
    end_time: string;
    interval_min: number;
    to_station: string;
}

export interface StopSchedule {
    trips: StopScheduleTrip[];
    intervals: StopScheduleInterval[];
}

// Расписание остановки нужно сразу трём местам карточки (ближайшие рейсы, плашка "сегодня
// не ходит", раскрытое расписание по дням) - грузим его один раз на все типы дня и держим
// в памяти: это статический справочник, за сессию он не меняется.
const stopScheduleCache = new Map<string, Promise<StopSchedule>>();

export function fetchStopSchedule(stopId: string | number): Promise<StopSchedule> {
    const key = String(stopId);
    const cached = stopScheduleCache.get(key);
    if (cached) return cached;

    const filters = { stop_id: Number(stopId) };
    const promise = Promise.all([
        fetchByFilter<StopScheduleTrip>('ground_transport/schedule_trips', filters),
        fetchByFilter<StopScheduleInterval>('ground_transport/schedule_intervals', filters),
    ]).then(([trips, intervals]) => ({ trips, intervals }));
    stopScheduleCache.set(key, promise);
    promise.catch(() => stopScheduleCache.delete(key));
    return promise;
}

export async function fetchSingle<T>(collection: string): Promise<T | null> {
    const res = await getJson<RecordsResponse<T>>(
        `/api/app/collections/${collection}/records?pageSize=1`,
    );
    return res.records[0]?.data ?? null;
}

export interface RawVehicle {
    deviceCode: string;
    gosNum: string;
    routeId: number;
    subrouteId: number;
    routeType: string;
    routeNumber: string;
    lat: number;
    lng: number;
    /** null - источник скорость не отдаёт (Краснодар). */
    speed: number | null;
    dir: number;
    navTime: string;
    lowFloor: boolean;
    // Есть только у фида Краснодара (lite.krdpt.ru, см. server/src/upstreamClient.js).
    model?: string;
    operator?: string;
    boardNumber?: string;
    /** Конечные остановки направления машины. */
    from?: string;
    to?: string;
}

// Карта опрашивает фид тремя вызовами разом (трамваи, троллейбусы, автобусы), а отдаёт он
// все машины сразу - одновременные вызовы делят один запрос. Кэша нет: следующий опрос
// всегда идёт в сеть.
let liveVehiclesInFlight: Promise<RawVehicle[]> | null = null;

export function fetchLiveVehicles(): Promise<RawVehicle[]> {
    if (!liveVehiclesInFlight) {
        liveVehiclesInFlight = getJson<{ vehicles: RawVehicle[] }>('/api/app/live/vehicles')
            .then(({ vehicles }) => vehicles)
            .finally(() => {
                liveVehiclesInFlight = null;
            });
    }
    return liveVehiclesInFlight;
}

export interface RailDeparture {
    number: string;
    title: string;
    transportType: 'train' | 'suburban' | string;
    carrier: string;
    carrierCode: string;
    departure: string | null;
    arrival: string | null;
    platform: string;
    terminal: string;
}

export interface RailScheduleResponse {
    date: string;
    station: { code: string; title: string; type: string };
    departures: RailDeparture[];
    total: number;
    source: { title: string; url: string };
}

// Расписание на день почти не меняется, а карточку станции открывают, закрывают и
// листают дни туда-обратно - повторно за тем же днём в сеть не ходим. Храним сам промис,
// чтобы и одновременные запросы шли одним. Ошибку не кэшируем - её стоит повторить.
const RAIL_SCHEDULE_CACHE_TTL_MS = 10 * 60 * 1000;
const railScheduleCache = new Map<
    string,
    { promise: Promise<RailScheduleResponse>; expiresAt: number }
>();

export class RailStationNotFoundError extends Error {}

export function fetchRailSchedule(
    lat: number,
    lng: number,
    date: string,
    transport: 'rail' | 'bus' | 'plane' = 'rail',
    event: 'departure' | 'arrival' = 'departure',
    name = '',
) {
    const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        date,
        transport,
        event,
        name,
    });
    const key = params.toString();
    const cached = railScheduleCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;

    const promise = fetch(`${ADMIN_API_URL}/api/app/live/rail/schedule?${key}`).then((res) => {
        // 404 - станции нет в Яндекс Расписаниях: это "расписания нет", а не сбой сети.
        if (res.status === 404) throw new RailStationNotFoundError();
        if (!res.ok) throw new Error(`admin/api rail/schedule -> HTTP ${res.status}`);
        return res.json() as Promise<RailScheduleResponse>;
    });
    railScheduleCache.set(key, { promise, expiresAt: Date.now() + RAIL_SCHEDULE_CACHE_TTL_MS });
    promise.catch((error) => {
        if (!(error instanceof RailStationNotFoundError)) railScheduleCache.delete(key);
    });
    return promise;
}
