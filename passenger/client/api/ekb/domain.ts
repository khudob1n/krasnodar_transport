import { ClientUnit } from 'transport-common/types/masstrans';
import { fetchAllRecords, fetchByFilter } from './collections';

// Кэширует результат первого успешного вызова fn() навсегда (справочники за время жизни
// вкладки не меняются) - но НЕ кэширует отказ: без сброса при отклонении один сетевой сбой
// (admin/api временно недоступен в момент первого обращения) записывает отклонённый промис
// в модульную переменную навечно, и loadRoutes()/loadRouteStopsRows()/... реджектятся
// мгновенно тем же промисом при каждом следующем вызове, даже когда бэкенд уже поднялся -
// остановки и машины не появляются на карте до перезагрузки страницы.
function memoizeAsync<T>(fn: () => Promise<T>): () => Promise<T> {
    let cached: Promise<T> | null = null;

    return () => {
        if (!cached) {
            cached = fn().catch((err) => {
                cached = null;
                throw err;
            });
        }

        return cached;
    };
}

// Наши data/ground_transport/routes.json и т.д. используют русские названия видов
// транспорта и однобуквенные коды в live-фиде, а не ClientUnit ('bus'/'tram'/'troll') -
// здесь всё сведение в одном месте.
export const ROUTE_TYPE_CODE_TO_UNIT: Record<string, ClientUnit> = {
    А: ClientUnit.Bus,
    Тм: ClientUnit.Tram,
    Тб: ClientUnit.Troll,
};

export const RU_TYPE_TO_UNIT: Record<string, ClientUnit> = {
    Автобус: ClientUnit.Bus,
    Трамвай: ClientUnit.Tram,
    Троллейбус: ClientUnit.Troll,
};

// data/ground_transport/routes.json
export interface RouteRecord {
    id: number;
    type: string;
    number: string;
    shortName: string;
    name: string;
    fromStation: string;
    toStation: string;
    companyName: string;
}

// data/ground_transport/stops.json
export interface StopRecord {
    id: number;
    name: string;
    direction: number;
    lat: number;
    lng: number;
}

export interface RouteStopsStation {
    id: number;
    name: string;
    lat: number;
    lng: number;
}
export interface RouteStopsDirection {
    subrouteId: number;
    directionTo: string;
    forward: boolean;
    stopsCount: number;
    stations: RouteStopsStation[];
}
export interface RouteStopsRecord {
    id: number;
    type: string;
    number: string;
    shortName: string;
    name: string;
    fromStation: string;
    toStation: string;
    directions: RouteStopsDirection[];
}

export interface RouteGeometryRecord {
    routeId: number;
    subrouteId: number;
    points: { lat: number; lng: number }[];
}

export const loadRoutes = memoizeAsync(() =>
    fetchAllRecords<RouteRecord>('ground_transport/routes'),
);

// Общий кэшированный фетч всей коллекции route_stops - и loadStopTypes, и
// loadValidSubroutes строят свои производные карты из одного и того же снэпшота, не
// дублируя запрос.
export const loadRouteStopsRows = memoizeAsync(() =>
    fetchAllRecords<RouteStopsRecord>('ground_transport/route_stops'),
);

// stopId -> виды транспорта, которые через неё идут - в data/ground_transport/stops.json
// (в отличие от Strapi Stop.attributes.type в референсе) нет собственного поля "тип", оно
// выводится из ground_transport/route_stops, как раньше делал старый Nuxt-клиент
// (useStopRoutes.ts).
export const loadStopTypes = memoizeAsync(() =>
    loadRouteStopsRows().then((rows) => {
        const map = new Map<number, Set<ClientUnit>>();
        for (const r of rows) {
            const unit = RU_TYPE_TO_UNIT[r.type];
            if (!unit) continue;
            for (const d of r.directions) {
                for (const s of d.stations) {
                    if (!map.has(s.id)) map.set(s.id, new Set());
                    map.get(s.id)!.add(unit);
                }
            }
        }
        return map;
    }),
);

// stopId -> маршруты, которые через неё проходят (по направлениям). Нужно карточке остановки,
// у которой нет расписания: у ~500 остановок его нет в данных вовсе, и без этого списка
// пассажир не узнал бы даже, что здесь ходит.
export interface StopRoute {
    routeId: number;
    type: ClientUnit;
    number: string;
    directionTo: string;
}

export const loadStopRoutes = memoizeAsync(() =>
    loadRouteStopsRows().then((rows) => {
        const map = new Map<string, StopRoute[]>();
        for (const r of rows) {
            const type = RU_TYPE_TO_UNIT[r.type];
            if (!type) continue;
            for (const d of r.directions) {
                d.stations.forEach((station, index) => {
                    // С конечной направления не уезжают - она не повод писать маршрут.
                    if (index === d.stations.length - 1) return;
                    const list = map.get(String(station.id)) ?? [];
                    if (
                        !list.some(
                            (item) => item.routeId === r.id && item.directionTo === d.directionTo,
                        )
                    ) {
                        list.push({
                            routeId: r.id,
                            type,
                            number: r.number,
                            directionTo: d.directionTo,
                        });
                    }
                    map.set(String(station.id), list);
                });
            }
        }
        // По номеру, как в остальных списках: 4, 8, 13, а не в порядке данных.
        map.forEach((list) =>
            list.sort(
                (a, b) =>
                    a.number.localeCompare(b.number, 'ru', { numeric: true }) ||
                    a.directionTo.localeCompare(b.directionTo, 'ru'),
            ),
        );
        return map;
    }),
);

// stopId -> подпись направления для поиска: следующая остановка, куда отсюда едет
// транспорт. Одноимённые остановки (их больше пятисот названий) обычно стоят по разные
// стороны одной улицы, и различить их проще всего по тому, какая остановка следующая.
// Если маршрутов несколько, берём самую частую следующую; остановка, которая бывает только
// последней в направлении, - конечная.
export type StopDirection = { next: string } | { terminal: true };

export const loadStopDirections = memoizeAsync(() =>
    loadRouteStopsRows().then((rows) => {
        const nextCounts = new Map<number, Map<string, number>>();
        const lastIn = new Set<number>();

        for (const r of rows) {
            for (const d of r.directions) {
                d.stations.forEach((station, index) => {
                    const next = d.stations[index + 1];
                    if (!next) {
                        lastIn.add(station.id);
                        return;
                    }
                    // Соседняя запись с тем же названием - та же остановка по другую сторону
                    // перекрёстка, подписью она не поможет.
                    if (next.name === station.name) return;
                    const counts = nextCounts.get(station.id) ?? new Map<string, number>();
                    counts.set(next.name, (counts.get(next.name) ?? 0) + 1);
                    nextCounts.set(station.id, counts);
                });
            }
        }

        const directions = new Map<string, StopDirection>();
        nextCounts.forEach((counts, stopId) => {
            const [next] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
            directions.set(String(stopId), { next });
        });
        lastIn.forEach((stopId) => {
            if (!directions.has(String(stopId))) directions.set(String(stopId), { terminal: true });
        });
        return directions;
    }),
);

export interface SubrouteDirection {
    from: string;
    to: string;
}

// "routeId:subrouteId" -> откуда/куда конкретно ЭТОГО направления (а не общие from/to
// маршрута из routes.json, одинаковые для обоих направлений - иначе, например, встречные
// рейсы 053-го в поиске выглядят двумя одинаковыми на вид строками). Отсутствие ключа
// также означает, что живой портал отдал subrouteId, которого нет в нашем снэпшоте
// направлений (портал успел обновить маршрут после того, как снэпшот собирался) - тогда
// помечаем машину предупреждением "едет не по маршруту" вместо тихого пустого списка
// остановок (см. massTransApi.getVehicleInfo).
//
// from берём из первой реальной остановки направления, а не из d.forward - у ~17%
// направлений в снэпшоте (route_stops.json) этот флаг не соответствует фактическому
// порядку остановок (например маршрут 13: у направления с forward=true реальная первая
// остановка - "40 лет ВЛКСМ", а не route.fromStation "7 Ключей"), так что доверять ему
// нельзя, а первая остановка в списке - всегда достоверна.
export const loadSubrouteDirections = memoizeAsync(() =>
    loadRouteStopsRows().then((rows) => {
        const map = new Map<string, SubrouteDirection>();
        for (const r of rows) {
            for (const d of r.directions) {
                const from = d.stations[0]?.name || r.fromStation;
                map.set(`${r.id}:${d.subrouteId}`, { from, to: d.directionTo });
            }
        }
        return map;
    }),
);

export function stopTypeOf(
    types: Set<ClientUnit> | undefined,
): 'bus' | 'tram' | 'troll' | 'troll-bus' {
    const set = types ?? new Set<ClientUnit>();
    const hasBus = set.has(ClientUnit.Bus);
    const hasTroll = set.has(ClientUnit.Troll);
    if (hasBus && hasTroll) return 'troll-bus';
    if (set.has(ClientUnit.Tram)) return 'tram';
    if (hasTroll) return 'troll';
    return 'bus';
}

export async function getRouteStops(routeId: number): Promise<RouteStopsRecord | null> {
    const rows = await fetchByFilter<RouteStopsRecord>('ground_transport/route_stops', {
        id: routeId,
    });
    return rows[0] ?? null;
}

export async function getRouteGeometry(routeId: number): Promise<RouteGeometryRecord[]> {
    return fetchByFilter<RouteGeometryRecord>('ground_transport/route_geometry', { routeId });
}
