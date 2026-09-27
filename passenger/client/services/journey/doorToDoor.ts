import {
    DESTINATION_ID,
    distanceMeters,
    Graph,
    isMetroStop,
    METRO_ENTRY_MIN,
    ORIGIN_ID,
    PlannerStop,
    WALK_M_PER_MIN,
} from './planner';
import { fetchWalkDistances, fetchWalkRoute, LatLngPoint, parsePoint } from './places';

/**
 * Маршрут «от двери до двери»: если откуда или куда - не остановка, а место (адрес, точка на
 * карте, местоположение), в граф поиска добавляется виртуальная остановка с пешими подходами
 * к ближайшим остановкам и станциям метро. Расстояния пешком - по улицам из OSRM
 * (одним запросом table), без него - по прямой с поправкой на извилистость.
 */

/** Остановки-кандидаты - в этом радиусе по прямой. */
const ACCESS_RADIUS_M = 1200;
/** Дальше этого по улицам к остановке не идём. */
const MAX_ACCESS_WALK_M = 1500;
const MAX_CANDIDATES = 50;
/** Места ближе этого (по прямой) - предлагаем дойти пешком без транспорта. */
const DIRECT_WALK_RADIUS_M = 2500;

type Walk = { to: number; minutes: number; meters: number };

/**
 * Куда идти пешком к остановке: у станции метро - ближайший к from вход, а не центр платформы
 * (у входа есть номер - он на указателе у станции).
 */
export function walkTarget(
    graph: Graph,
    stopId: number,
    from: LatLngPoint,
): (LatLngPoint & { number?: number | null }) | null {
    const stop = graph.stops.get(stopId);
    if (!stop) return null;
    if (!isMetroStop(stopId) || !graph.metro) return stop;
    const entrances = graph.metro.entrances.filter((entrance) => entrance.stationId === -stopId);
    if (!entrances.length) return stop;
    return entrances.reduce((best, entrance) =>
        distanceMeters(from, entrance) < distanceMeters(from, best) ? entrance : best,
    );
}

const walkOf = (meters: number, stopId: number) => ({
    meters,
    minutes: meters / WALK_M_PER_MIN + (isMetroStop(stopId) ? METRO_ENTRY_MIN : 0),
});

const accessCache = new Map<string, Promise<Walk[]>>();

/** Пешие подходы от места к остановкам (reverse - от остановок к месту). */
function accessWalks(graph: Graph, point: LatLngPoint, reverse: boolean): Promise<Walk[]> {
    const key = `${reverse ? 'to' : 'from'}:${point.lat},${point.lng}`;
    const cached = accessCache.get(key);
    if (cached) return cached;

    const candidates: { stop: PlannerStop; target: LatLngPoint; straight: number }[] = [];
    graph.stops.forEach((stop) => {
        const target = walkTarget(graph, stop.id, point);
        if (!target) return;
        const straight = distanceMeters(point, target);
        if (straight <= ACCESS_RADIUS_M) candidates.push({ stop, target, straight });
    });
    candidates.sort((a, b) => a.straight - b.straight);
    const nearest = candidates.slice(0, MAX_CANDIDATES);

    const promise = fetchWalkDistances(
        point,
        nearest.map((item) => item.target),
        reverse,
    ).then((distances) => {
        const walks: Walk[] = [];
        nearest.forEach((item, index) => {
            // OSRM недоступен - по прямой; пути нет (другой берег пруда) - остановку пропускаем.
            const meters = distances ? distances[index] : item.straight * 1.3;
            if (meters === null || meters === undefined || meters > MAX_ACCESS_WALK_M) return;
            walks.push({ to: item.stop.id, ...walkOf(meters, item.stop.id) });
        });
        // Совсем глухое место - хотя бы до ближайшей остановки.
        if (!walks.length && nearest.length) {
            walks.push({
                to: nearest[0].stop.id,
                ...walkOf(nearest[0].straight * 1.3, nearest[0].stop.id),
            });
        }
        if (!distances) accessCache.delete(key);
        return walks;
    });

    accessCache.set(key, promise);
    return promise;
}

async function directWalk(from: LatLngPoint, to: LatLngPoint): Promise<Walk | null> {
    const straight = distanceMeters(from, to);
    if (straight > DIRECT_WALK_RADIUS_M) return null;
    const route = await fetchWalkRoute(from, to);
    const meters = route ? route.meters : straight * 1.3;
    return { to: DESTINATION_ID, meters, minutes: meters / WALK_M_PER_MIN };
}

export interface Endpoints {
    graph: Graph;
    fromId: number;
    toId: number;
}

/**
 * Граф для поиска между from и to (id остановки или «широта,долгота»). Базовый граф не
 * меняется: копируются только затронутые списки пеших переходов.
 */
export async function prepareEndpoints(
    base: Graph,
    from: string,
    to: string,
    labels: Record<string, string>,
): Promise<Endpoints> {
    const fromPoint = parsePoint(from);
    const toPoint = parsePoint(to);
    if (!fromPoint && !toPoint) return { graph: base, fromId: Number(from), toId: Number(to) };

    const stops = new Map(base.stops);
    const walks = new Map(base.walks);
    const fromId = fromPoint ? ORIGIN_ID : Number(from);
    const toId = toPoint ? DESTINATION_ID : Number(to);

    const [originWalks, destinationWalks] = await Promise.all([
        fromPoint ? accessWalks(base, fromPoint, false) : Promise.resolve([]),
        toPoint ? accessWalks(base, toPoint, true) : Promise.resolve([]),
    ]);

    if (fromPoint) {
        stops.set(ORIGIN_ID, {
            id: ORIGIN_ID,
            name: labels[from] ?? 'Точка на карте',
            ...fromPoint,
        });
        walks.set(ORIGIN_ID, originWalks);
    }

    if (toPoint) {
        stops.set(DESTINATION_ID, {
            id: DESTINATION_ID,
            name: labels[to] ?? 'Точка на карте',
            ...toPoint,
        });
        walks.set(DESTINATION_ID, destinationWalks);
        // После поездки пассажир идёт от остановки к месту - связь нужна и в эту сторону.
        destinationWalks.forEach((walk) => {
            walks.set(walk.to, [
                ...(walks.get(walk.to) ?? []),
                { to: DESTINATION_ID, minutes: walk.minutes, meters: walk.meters },
            ]);
        });
    }

    // Пешком без транспорта: место - место, место - остановка, остановка - место.
    const fromCoords = fromPoint ?? stops.get(fromId);
    const toCoords = toPoint ?? stops.get(toId);
    if (fromCoords && toCoords) {
        const direct = await directWalk(fromCoords, toCoords);
        if (direct) {
            const link = { ...direct, to: toId };
            const known = (walks.get(fromId) ?? []).filter((walk) => walk.to !== toId);
            walks.set(fromId, [...known, link]);
        }
    }

    return { graph: { ...base, stops, walks }, fromId, toId };
}
