import { ClientUnit, Route, StopInfoItem, Unit, UnitArriveStop } from 'transport-common/types/masstrans';
import { StrapiStop, StrapiUnitInfo } from 'transport-common/types/strapi';
import {
    fetchLiveVehicles,
    fetchStopSchedule,
    loadCollection,
    RawVehicle,
} from 'api/ekb/collections';
import {
    getRouteGeometry,
    getRouteStops,
    loadRoutes,
    loadRouteStopsRows,
    loadStopTypes,
    loadSubrouteDirections,
    ROUTE_TYPE_CODE_TO_UNIT,
    RU_TYPE_TO_UNIT,
    RouteRecord,
    RouteStopsRecord,
    StopRecord,
    stopTypeOf,
    SubrouteDirection,
} from 'api/ekb/domain';

// Единственный файл, который реально "подключает данные": массив функций massTransApi
// ниже раньше ходил в их бэкенд (маршрут.екатеринбург.рф через TRANSPORT_API_URL) и в
// Strapi (остановки/паспорта машин) - оба недоступны. Сигнатуры и типы возврата оставлены
// как были, чтобы остальной (не тронутый) UI-код работал без изменений - меняется только
// то, откуда берутся данные: наш admin/api (server/+data/ в корне проекта).

// Unit из transport-common не знает про warning (он появился уже в нашей адаптации под
// свои данные) - остальной UI-код (MapVehiclesItemProps и т.д.) уже ожидает его опционально.
// navTime - время последних координат из живого фида (UTC), см. components/Map/Vehicles/staleness.ts.
export type VehicleUnit = Unit & { warning?: boolean; navTime?: string; hasSpeed?: boolean };

// Для поиска по маршрутам (а не по живым машинам, см. MapSearchBar) - один пункт на маршрут
// со всеми его официальными направлениями из статического снэпшота route_stops.
export interface RouteSearchDirection {
    routeDirection: string;
    firstStation: string;
    lastStation: string;
}
export interface RouteSearchItem {
    routeId: number;
    num: string;
    type: ClientUnit;
    firstStation: string;
    lastStation: string;
    directions: RouteSearchDirection[];
}

function unitFromRaw(
    raw: RawVehicle,
    routesById: Map<number, RouteRecord>,
    subrouteDirections: Map<string, SubrouteDirection>,
): VehicleUnit | null {
    const type = ROUTE_TYPE_CODE_TO_UNIT[raw.routeType];
    if (!type) return null;
    const route = routesById.get(raw.routeId);
    // Направление-специфичные откуда/куда (см. loadSubrouteDirections) - у route.fromStation/
    // toStation нет понятия направления, оба конца маршрута одинаковы для встречных рейсов,
    // из-за чего они неразличимы в UI (например, в результатах поиска).
    const direction = subrouteDirections.get(`${raw.routeId}:${raw.subrouteId}`);

    return {
        id: raw.deviceCode,
        routeId: raw.routeId,
        num: raw.routeNumber,
        depoTitle: route?.companyName || raw.operator || '',
        firstStation: direction?.from || route?.fromStation || raw.from || '',
        lastStation: direction?.to || route?.toStation || raw.to || '',
        routeDirection: String(raw.subrouteId),
        type,
        course: raw.dir,
        accessibility: raw.lowFloor,
        coords: [raw.lat, raw.lng],
        model: raw.model || '',
        speed: raw.speed ?? 0,
        hasSpeed: raw.speed !== null,
        stateNumber: raw.gosNum,
        boardId: Number(raw.boardNumber) || Number(raw.deviceCode) || 0,
        // Живой портал иногда отдаёт subrouteId, которого нет в нашем снэпшоте route_stops
        // (портал обновил маршрут после того, как снэпшот собирался) - в этом случае у
        // машины физически не может быть списка остановок (getVehicleInfo вернёт []), и
        // честнее показать предупреждение, чем молча ничего не показывать.
        warning: !direction,
        navTime: raw.navTime,
    };
}

export const massTransApi = {
    // null (а не []) на ошибке - осознанно: MapTransport опрашивает это раз в 30с и различает
    // "сбой сети, оставить как было на карте" от "живых машин этого типа сейчас правда нет".
    // [] тут было бы truthy и неотличимо от настоящего пустого ответа.
    getVehicles: async (type: ClientUnit): Promise<VehicleUnit[] | null> => {
        try {
            const [raw, routes, subrouteDirections] = await Promise.all([
                fetchLiveVehicles(),
                loadRoutes(),
                loadSubrouteDirections(),
            ]);
            const routesById = new Map(routes.map((r) => [r.id, r]));

            return raw
                .map((v) => unitFromRaw(v, routesById, subrouteDirections))
                .filter((u): u is VehicleUnit => u !== null && u.type === type);
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    getRoutesList: async (): Promise<RouteSearchItem[]> => {
        try {
            const rows = await loadRouteStopsRows();

            return rows
                .map((r) => {
                    const type = RU_TYPE_TO_UNIT[r.type];
                    if (!type) return null;

                    return {
                        routeId: r.id,
                        num: r.number,
                        type,
                        firstStation: r.fromStation,
                        lastStation: r.toStation,
                        directions: r.directions.map((d) => ({
                            routeDirection: String(d.subrouteId),
                            // Первая реальная остановка направления, а не d.forward - см.
                            // комментарий в loadSubrouteDirections (api/ekb/domain.ts).
                            firstStation: d.stations[0]?.name || r.fromStation,
                            lastStation: d.directionTo,
                        })),
                    };
                })
                .filter((r): r is RouteSearchItem => r !== null);
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    getStops: async (): Promise<StrapiStop[]> => {
        try {
            const [stops, types] = await Promise.all([
                loadCollection<StopRecord>('ground_transport/stops'),
                loadStopTypes(),
            ]);

            return stops.map((s) => ({
                id: s.id,
                attributes: {
                    title: s.name,
                    stopId: String(s.id),
                    coords: [s.lat, s.lng] as [number, number],
                    type: stopTypeOf(types.get(s.id)) as any,
                },
            }));
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    // Паспорта машин (модель/год/фото) жили в Strapi unit-info, которой у нас нет -
    // честно возвращаем пусто, а не выдумываем данные. Сигнатура сохранена (аргумент не
    // используется), чтобы вызывающий код (MapVehiclesSidebar) не трогать.
    getUnitInfo: async (_params: {
        type: ClientUnit;
        boardId: number;
        stateNumber: string;
        num: string;
    }): Promise<StrapiUnitInfo[]> => [],

    getRoute: async (routeId: number): Promise<Route | null> => {
        try {
            const [routeStops, geometry] = await Promise.all([
                getRouteStops(routeId),
                getRouteGeometry(routeId),
            ]);
            if (!routeStops) return null;

            const geometryBySubroute = new Map(geometry.map((g) => [g.subrouteId, g]));

            return {
                id: routeStops.id,
                num: routeStops.number,
                title: routeStops.name,
                depos: [],
                races: routeStops.directions.map((d) => ({
                    id: String(d.subrouteId),
                    coordsList: (geometryBySubroute.get(d.subrouteId)?.points || []).map(
                        (p) => [p.lat, p.lng] as [number, number],
                    ),
                    // Первая реальная остановка направления, а не d.forward - см.
                    // комментарий в loadSubrouteDirections (api/ekb/domain.ts).
                    firstStation: d.stations[0]?.name || routeStops.fromStation,
                    lastStation: d.directionTo,
                    raceType: String(d.subrouteId),
                    stops: d.stations.map((s) => ({
                        title: s.name,
                        stopId: String(s.id),
                        coords: [s.lat, s.lng] as [number, number],
                    })),
                })),
            };
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    // Прогноза прибытия у нас нет (наш прокси отдаёт только текущие координаты, не ETA) -
    // строим список ближайших рейсов по статическому расписанию (data/ground_transport/
    // schedule_trips.json + schedule_intervals.json) на сегодняшний день недели.
    getStopInfo: async (stopId: string): Promise<StopInfoItem[]> => {
        try {
            const id = Number(stopId);
            const now = new Date();
            const dayType = now.getDay() === 0 || now.getDay() === 6 ? 'выходные' : 'будни';
            const nowLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            const [routes, schedule] = await Promise.all([loadRoutes(), fetchStopSchedule(id)]);
            const trips = schedule.trips.filter((trip) => trip.day_type === dayType);
            const intervals = schedule.intervals.filter(
                (interval) => interval.day_type === dayType,
            );

            const routeIdByNumber = new Map(routes.map((r) => [`${r.type}-${r.number}`, r.id]));

            // routeDirection здесь должен быть subrouteId (как raceType у getRoute), а не
            // название конечной - иначе MapRoutes.tsx не находит совпадающий race и линия
            // маршрута не рисуется при клике на рейс в сайдбаре остановки.
            const routeIdsInUse = new Set<number>();
            for (const t of trips) {
                const rid = routeIdByNumber.get(`${t.route_type}-${t.route_number}`);
                if (rid) routeIdsInUse.add(rid);
            }
            for (const i of intervals) {
                const rid = routeIdByNumber.get(`${i.route_type}-${i.route_number}`);
                if (rid) routeIdsInUse.add(rid);
            }

            const routeStopsEntries = await Promise.all(
                Array.from(routeIdsInUse).map(async (rid) => [rid, await getRouteStops(rid)] as const),
            );
            const routeStopsByRouteId = new Map(routeStopsEntries);

            const subrouteIdFor = (routeId: number, toStation: string): string => {
                const direction = routeStopsByRouteId
                    .get(routeId)
                    ?.directions.find((d) => d.directionTo === toStation);
                return direction ? String(direction.subrouteId) : '';
            };

            const tripItems: StopInfoItem[] = trips
                .filter((t) => t.time >= nowLabel)
                .map((t) => {
                    const routeId = routeIdByNumber.get(`${t.route_type}-${t.route_number}`) || 0;
                    return {
                        arriveTime: t.time,
                        route: t.route_number,
                        routeId,
                        type: RU_TYPE_TO_UNIT[t.route_type] || ClientUnit.Bus,
                        to: t.to_station,
                        routeDirection: subrouteIdFor(routeId, t.to_station),
                        through: [],
                    };
                });

            const intervalItems: StopInfoItem[] = intervals
                .filter((i) => nowLabel >= i.start_time && nowLabel <= i.end_time && i.interval_min > 0)
                .map((i) => {
                    const [h, m] = nowLabel.split(':').map(Number);
                    const minutesSinceStart = h * 60 + m - toMinutes(i.start_time);
                    const stepsToNext = Math.ceil(minutesSinceStart / i.interval_min) * i.interval_min;
                    const nextMinutes = toMinutes(i.start_time) + stepsToNext;
                    const routeId = routeIdByNumber.get(`${i.route_type}-${i.route_number}`) || 0;
                    return {
                        arriveTime: fromMinutes(nextMinutes),
                        route: i.route_number,
                        routeId,
                        type: RU_TYPE_TO_UNIT[i.route_type] || ClientUnit.Bus,
                        to: i.to_station,
                        routeDirection: subrouteIdFor(routeId, i.to_station),
                        through: [],
                    };
                });

            return [...tripItems, ...intervalItems].sort((a, b) => a.arriveTime.localeCompare(b.arriveTime));
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    // Список остановок впереди по маршруту конкретной машины - берём из статического
    // route_stops по направлению (subrouteId) этой машины, без ETA на каждую (нет источника
    // прогноза, только факт положения на карте).
    getVehicleInfo: async (unitId: string): Promise<UnitArriveStop[]> => {
        try {
            const raw = await fetchLiveVehicles();
            const vehicle = raw.find((v) => v.deviceCode === unitId);
            if (!vehicle) return [];

            const routeStops = await getRouteStops(vehicle.routeId);
            const direction = routeStops?.directions.find((d) => d.subrouteId === vehicle.subrouteId);
            if (!direction) return [];

            return direction.stations.map((s) => ({
                title: s.name,
                stopId: String(s.id),
                coords: [s.lat, s.lng] as [number, number],
            }));
        } catch (e) {
            console.error(e);
            return [];
        }
    },
};

function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
function fromMinutes(total: number): string {
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
