import { ClientUnit } from 'transport-common/types/masstrans';

import { RouteStopsRecord, RU_TYPE_TO_UNIT } from 'api/ekb/domain';

import { MetroData } from './metro';

/**
 * Поиск маршрута между двумя остановками с пересадками.
 *
 * Данные - только статические: последовательности остановок по направлениям маршрутов
 * (route_stops) и их координаты. Прогноза движения у нас нет, поэтому время в пути
 * оценивается по расстоянию, а ожидание - условным штрафом. Реальные отправления по
 * расписанию подставляются потом, уже для найденных вариантов (см. schedule.ts).
 *
 * Алгоритм - упрощённый RAPTOR: раунд k находит лучшее время до каждой остановки не
 * больше чем за k поездок. После каждой поездки можно пройти пешком до соседней
 * остановки (другая сторона улицы, трамвайная остановка рядом с автобусной).
 *
 * Метро - такое же «направление», только его станции в графе с отрицательными id, а до
 * входа можно дойти дальше, чем между остановками (см. addMetro).
 */

/** Вид транспорта в поиске: наземный или метро. */
export type JourneyMode = ClientUnit | 'metro';

export const isMetroStop = (stopId: number) => stopId < 0;

/**
 * Места «откуда» и «куда», если это не остановка, а адрес или точка на карте: в графе поиска
 * они - две виртуальные остановки с пешими подходами к ближайшим настоящим (см. doorToDoor.ts).
 */
export const ORIGIN_ID = 1_000_000_001;
export const DESTINATION_ID = 1_000_000_002;
export const isPlaceId = (id: number) => id === ORIGIN_ID || id === DESTINATION_ID;

export interface PlannerStop {
    id: number;
    name: string;
    lat: number;
    lng: number;
}

/** Одно направление маршрута - то, на что садятся. */
export interface Pattern {
    routeId: number;
    subrouteId: number;
    number: string;
    /** Тип из данных: «Трамвай», «Троллейбус», «Автобус», «Метро». */
    routeType: string;
    type: JourneyMode;
    /** Условное ожидание на посадке, если оно не как у наземного транспорта. */
    boardWait?: number;
    directionTo: string;
    stops: number[];
    /** Минуты от первой остановки направления до каждой следующей. */
    cumulative: number[];
}

export interface Graph {
    stops: Map<number, PlannerStop>;
    patterns: Pattern[];
    /** Остановка -> [направление, позиция в нём]. */
    stopPatterns: Map<number, [number, number][]>;
    /** Остановка -> соседние остановки в пешей доступности с минутами пешком. */
    walks: Map<number, { to: number; minutes: number; meters: number }[]>;
    /** Данные метро для расписания; нет - маршрут без метро. */
    metro?: MetroData;
}

export type Leg =
    | {
          kind: 'walk';
          from: number;
          to: number;
          minutes: number;
          meters: number;
      }
    | {
          kind: 'ride';
          pattern: Pattern;
          from: number;
          to: number;
          boardIndex: number;
          alightIndex: number;
          minutes: number;
          /**
           * Все направления, которые везут от from до to примерно за столько же остановок -
           * параллельные трамваи на общем участке. Первым идёт pattern. Садиться можно в любой,
           * ближайший рейс выбирается по расписанию.
           */
          alternatives: { pattern: Pattern; boardIndex: number; alightIndex: number }[];
      };

export interface Itinerary {
    legs: Leg[];
    /** Оценка без расписания: пешком + ожидание + в пути. */
    estimatedMinutes: number;
    /** 0 - весь путь пешком. */
    rides: number;
}

// Скорости «на ходу», без остановок: стоянка учтена отдельно на каждой промежуточной
// остановке. Путь по улицам длиннее прямой - коэффициент извилистости.
const RUN_SPEED_M_PER_MIN: Record<ClientUnit, number> = {
    [ClientUnit.Tram]: 360, // ~22 км/ч
    [ClientUnit.Troll]: 350, // ~21 км/ч
    [ClientUnit.Bus]: 420, // ~25 км/ч
};
const DETOUR = 1.2;
const DWELL_MIN = 0.4;

export const WALK_M_PER_MIN = 70; // ~4,2 км/ч
const WALK_DETOUR = 1.3;
const MAX_TRANSFER_WALK_M = 400;
/** От выбранной остановки можно дойти до соседней, если так быстрее - например, она на другой стороне улицы. */
const MAX_ACCESS_WALK_M = 300;

/** До метро готовы идти дальше, чем до соседней остановки. Считается до ближайшего входа. */
const MAX_METRO_WALK_M = 700;
/** Спуститься от входа к платформе и подняться обратно. */
export const METRO_ENTRY_MIN = 2;
/** Поезда ходят часто (4-11 мин) - и ожидание в поиске меньше, чем у наземного транспорта. */
const METRO_BOARD_WAIT_MIN = 3;
/** Скорость на перегоне, если его нет в расписании (последний перед конечной). */
const METRO_SPEED_M_PER_MIN = 700;

// Если хотя бы один конец - станция метро, идти можно до входа, то есть дальше. У места
// «откуда/куда» подходы уже отобраны по расстоянию при построении графа.
const accessLimit = (from: number, to: number) => {
    if (isPlaceId(from) || isPlaceId(to)) return Infinity;
    return isMetroStop(from) || isMetroStop(to) ? MAX_METRO_WALK_M : MAX_ACCESS_WALK_M;
};

/** Условное ожидание на посадке. Настоящее ожидание считается по расписанию после поиска. */
const BOARD_WAIT_MIN = 5;
/** Пересадка неудобна сама по себе: без штрафа поиск охотно меняет 1 поездку на 3 ради минуты. */
const TRANSFER_PENALTY_MIN = 4;

/** Поездок в варианте по умолчанию (2 пересадки); пассажир меняет в настройках (maxTransfers). */
export const MAX_RIDES = 3;

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

export const walkMinutes = (meters: number) => (meters * WALK_DETOUR) / WALK_M_PER_MIN;

export function buildGraph(rows: RouteStopsRecord[], metro?: MetroData | null): Graph {
    const stops = new Map<number, PlannerStop>();
    const patterns: Pattern[] = [];
    const stopPatterns = new Map<number, [number, number][]>();

    rows.forEach((row) => {
        const type = RU_TYPE_TO_UNIT[row.type];
        if (!type) return;

        row.directions.forEach((direction) => {
            // Одна и та же остановка подряд (бывает в данных у разворотов) - лишний шаг.
            const stations = direction.stations.filter(
                (station, index, all) => index === 0 || all[index - 1].id !== station.id,
            );
            if (stations.length < 2) return;

            const cumulative = [0];
            for (let i = 1; i < stations.length; i += 1) {
                const meters = distanceMeters(stations[i - 1], stations[i]) * DETOUR;
                cumulative.push(cumulative[i - 1] + meters / RUN_SPEED_M_PER_MIN[type] + DWELL_MIN);
            }

            const patternIndex = patterns.length;
            patterns.push({
                routeId: row.id,
                subrouteId: direction.subrouteId,
                number: row.number,
                routeType: row.type,
                type,
                directionTo: direction.directionTo,
                stops: stations.map((station) => station.id),
                cumulative,
            });

            stations.forEach((station, position) => {
                if (!stops.has(station.id)) {
                    stops.set(station.id, {
                        id: station.id,
                        name: station.name,
                        lat: station.lat,
                        lng: station.lng,
                    });
                }
                const list = stopPatterns.get(station.id) ?? [];
                list.push([patternIndex, position]);
                stopPatterns.set(station.id, list);
            });
        });
    });

    const graph: Graph = { stops, patterns, stopPatterns, walks: buildWalks(stops) };
    if (metro) addMetro(graph, metro);
    return graph;
}

/**
 * Линия метро - направления по станциям, время перегонов из расписания. С наземными
 * остановками станции связаны пешком: от остановки до ближайшего входа плюс спуск.
 */
function addMetro(graph: Graph, metro: MetroData) {
    const { stops, patterns, stopPatterns, walks } = graph;
    const stationById = new Map(metro.stations.map((station) => [station.id, station]));

    metro.stations.forEach((station) => {
        stops.set(-station.id, {
            id: -station.id,
            name: station.name,
            lat: station.lat,
            lng: station.lng,
        });
        walks.set(-station.id, []);
    });

    metro.directions.forEach((direction) => {
        const stations = direction.stationIds
            .map((id) => stationById.get(id))
            .filter(Boolean) as MetroData['stations'];
        if (stations.length < 2) return;

        const cumulative = [0];
        for (let i = 1; i < stations.length; i += 1) {
            const scheduled = metro.hopMinutes.get(`${stations[i - 1].name}>${stations[i].name}`);
            const estimated =
                distanceMeters(stations[i - 1], stations[i]) / METRO_SPEED_M_PER_MIN + DWELL_MIN;
            cumulative.push(cumulative[i - 1] + (scheduled ?? estimated));
        }

        const patternIndex = patterns.length;
        patterns.push({
            routeId: -metro.lineId,
            subrouteId: -direction.id,
            number: metro.lineNumber,
            routeType: 'Метро',
            type: 'metro',
            directionTo: direction.terminus,
            stops: stations.map((station) => -station.id),
            cumulative,
            boardWait: METRO_BOARD_WAIT_MIN,
        });

        stations.forEach((station, position) => {
            const list = stopPatterns.get(-station.id) ?? [];
            list.push([patternIndex, position]);
            stopPatterns.set(-station.id, list);
        });
    });

    // Пешком между наземными остановками и станциями - до ближайшего входа.
    const entrancesOf = new Map<number, { lat: number; lng: number }[]>();
    metro.entrances.forEach((entrance) => {
        const list = entrancesOf.get(entrance.stationId) ?? [];
        list.push(entrance);
        entrancesOf.set(entrance.stationId, list);
    });

    stops.forEach((stop) => {
        if (isMetroStop(stop.id)) return;
        metro.stations.forEach((station) => {
            const points = entrancesOf.get(station.id) ?? [station];
            const meters = Math.min(...points.map((point) => distanceMeters(stop, point)));
            if (meters > MAX_METRO_WALK_M) return;
            const minutes = walkMinutes(meters) + METRO_ENTRY_MIN;
            walks.get(stop.id)?.push({ to: -station.id, minutes, meters });
            walks.get(-station.id)?.push({ to: stop.id, minutes, meters });
        });
    });

    graph.metro = metro;
}

// Сетка ~500 м, чтобы не сравнивать каждую остановку с каждой (их ~1600).
function buildWalks(stops: Map<number, PlannerStop>) {
    const CELL = 0.005;
    const cellKey = (lat: number, lng: number) =>
        `${Math.floor(lat / CELL)}:${Math.floor(lng / (CELL * 2))}`;
    const grid = new Map<string, PlannerStop[]>();

    stops.forEach((stop) => {
        const key = cellKey(stop.lat, stop.lng);
        const cell = grid.get(key) ?? [];
        cell.push(stop);
        grid.set(key, cell);
    });

    const walks: Graph['walks'] = new Map();

    stops.forEach((stop) => {
        const row = Math.floor(stop.lat / CELL);
        const col = Math.floor(stop.lng / (CELL * 2));
        const list: { to: number; minutes: number; meters: number }[] = [];

        for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
                grid.get(`${row + dr}:${col + dc}`)?.forEach((other) => {
                    if (other.id === stop.id) return;
                    const meters = distanceMeters(stop, other);
                    if (meters <= MAX_TRANSFER_WALK_M) {
                        list.push({ to: other.id, minutes: walkMinutes(meters), meters });
                    }
                });
            }
        }

        walks.set(stop.id, list);
    });

    return walks;
}

type Parent =
    | { kind: 'origin' }
    | { kind: 'walk'; from: number; meters: number; minutes: number }
    | { kind: 'ride'; pattern: number; from: number; boardIndex: number; alightIndex: number };

interface SearchOptions {
    /** Маршруты (routeId), которые нельзя использовать - для поиска альтернатив. */
    bannedRoutes?: Set<number>;
    /** Больше поездок не ищем: пересадок - на одну меньше. */
    maxRides?: number;
}

/**
 * Лучший вариант для каждого числа поездок (1..MAX_RIDES). Вариант с большим числом
 * пересадок попадает в результат, только если он заметно быстрее.
 */
function search(
    graph: Graph,
    fromId: number,
    toId: number,
    options: SearchOptions = {},
): Itinerary[] {
    const { stops, patterns, stopPatterns, walks } = graph;
    const origin = stops.get(fromId);
    const destination = stops.get(toId);
    if (!origin || !destination) return [];

    // Доступ пешком от выбранной остановки и до выбранной остановки.
    const egress = new Map<number, number>([[toId, 0]]);
    walks.get(toId)?.forEach(({ to, minutes, meters }) => {
        if (meters <= accessLimit(toId, to)) egress.set(to, minutes);
    });

    const labels: Map<number, number>[] = [new Map()];
    const parents: Map<number, Parent>[] = [new Map()];
    const best = new Map<number, number>();

    const setLabel = (round: number, stop: number, value: number, parent: Parent) => {
        labels[round].set(stop, value);
        parents[round].set(stop, parent);
        best.set(stop, value);
    };

    setLabel(0, fromId, 0, { kind: 'origin' });
    // Прямо к цели пешком - отдельный вариант (planJourneys). Здесь такая метка отсекла бы
    // все поездки медленнее пешехода.
    walks.get(fromId)?.forEach(({ to, minutes, meters }) => {
        if (to !== toId && meters <= accessLimit(fromId, to))
            setLabel(0, to, minutes, { kind: 'walk', from: fromId, meters, minutes });
    });

    let marked = new Set(labels[0].keys());
    const targetCost = () => {
        let result = Infinity;
        egress.forEach((walk, stop) => {
            const value = best.get(stop);
            if (value !== undefined) result = Math.min(result, value + walk);
        });
        return result;
    };

    const results: { round: number; cost: number; stop: number }[] = [];

    const maxRides = options.maxRides ?? MAX_RIDES;
    for (let round = 1; round <= maxRides && marked.size; round += 1) {
        labels.push(new Map());
        parents.push(new Map());
        const previous = labels[round - 1];
        const improved = new Set<number>();

        // Для каждого направления - самая ранняя отмеченная остановка на нём.
        const queue = new Map<number, number>();
        marked.forEach((stop) => {
            stopPatterns.get(stop)?.forEach(([patternIndex, position]) => {
                if (options.bannedRoutes?.has(patterns[patternIndex].routeId)) return;
                const current = queue.get(patternIndex);
                if (current === undefined || position < current) queue.set(patternIndex, position);
            });
        });

        const transferPenalty = round > 1 ? TRANSFER_PENALTY_MIN : 0;

        queue.forEach((startPosition, patternIndex) => {
            const pattern = patterns[patternIndex];
            const boardPenalty = (pattern.boardWait ?? BOARD_WAIT_MIN) + transferPenalty;
            let boardPosition = -1;
            let boardBase = Infinity; // стоимость посадки минус cumulative[boardPosition]

            for (let position = startPosition; position < pattern.stops.length; position += 1) {
                const stop = pattern.stops[position];

                if (boardPosition >= 0) {
                    const arrival = boardBase + pattern.cumulative[position];
                    const bound = Math.min(best.get(stop) ?? Infinity, targetCost());
                    if (arrival < bound) {
                        setLabel(round, stop, arrival, {
                            kind: 'ride',
                            pattern: patternIndex,
                            from: pattern.stops[boardPosition],
                            boardIndex: boardPosition,
                            alightIndex: position,
                        });
                        improved.add(stop);
                    }
                }

                const ready = previous.get(stop);
                if (ready !== undefined) {
                    const base = ready + boardPenalty - pattern.cumulative[position];
                    if (base < boardBase) {
                        boardBase = base;
                        boardPosition = position;
                    }
                }
            }
        });

        // Пешие переходы после поездки - по одному, двух подряд не бывает.
        const walked = new Set<number>();
        improved.forEach((stop) => {
            const value = labels[round].get(stop)!;
            walks.get(stop)?.forEach(({ to, minutes, meters }) => {
                const arrival = value + minutes;
                if (arrival < Math.min(best.get(to) ?? Infinity, targetCost())) {
                    setLabel(round, to, arrival, { kind: 'walk', from: stop, meters, minutes });
                    walked.add(to);
                }
            });
        });

        marked = new Set(Array.from(improved).concat(Array.from(walked)));

        // Лучший выход к цели в этом раунде.
        let roundBest: { cost: number; stop: number } | null = null;
        egress.forEach((walk, stop) => {
            const value = labels[round].get(stop);
            if (value === undefined) return;
            // Заканчивать пешком на walk-метке - значит два перехода подряд.
            if (walk > 0 && parents[round].get(stop)?.kind === 'walk') return;
            const cost = value + walk;
            if (!roundBest || cost < roundBest.cost) roundBest = { cost, stop };
        });
        if (roundBest) results.push({ round, ...(roundBest as { cost: number; stop: number }) });
    }

    const itineraries: Itinerary[] = [];
    let bestSoFar = Infinity;

    results.forEach(({ round, cost, stop }) => {
        // Лишняя пересадка должна окупаться хотя бы парой минут.
        if (cost >= bestSoFar - 2) return;
        const legs = reconstruct(graph, parents, round, stop);
        if (!legs) return;
        if (stop !== toId) {
            // Пешая связь уже посчитана: у метро - до ближайшего входа и с подъёмом.
            const link = walks.get(stop)?.find((walk) => walk.to === toId);
            const meters = link?.meters ?? distanceMeters(stops.get(stop)!, destination);
            const minutes = link?.minutes ?? walkMinutes(meters);
            legs.push({ kind: 'walk', from: stop, to: toId, meters, minutes });
        }
        bestSoFar = cost;
        itineraries.push({
            legs,
            estimatedMinutes: cost,
            rides: legs.filter((leg) => leg.kind === 'ride').length,
        });
    });

    return itineraries;
}

function reconstruct(
    graph: Graph,
    parents: Map<number, Parent>[],
    round: number,
    stop: number,
): Leg[] | null {
    const legs: Leg[] = [];
    let currentRound = round;
    let current = stop;

    for (let guard = 0; guard < 20; guard += 1) {
        const parent = parents[currentRound].get(current);
        if (!parent) return null;

        if (parent.kind === 'origin') return legs.reverse();

        if (parent.kind === 'walk') {
            legs.push({
                kind: 'walk',
                from: parent.from,
                to: current,
                meters: parent.meters,
                minutes: parent.minutes,
            });
            current = parent.from;
            continue;
        }

        const pattern = graph.patterns[parent.pattern];
        legs.push({
            kind: 'ride',
            pattern,
            from: parent.from,
            to: current,
            boardIndex: parent.boardIndex,
            alightIndex: parent.alightIndex,
            minutes: pattern.cumulative[parent.alightIndex] - pattern.cumulative[parent.boardIndex],
            alternatives: [],
        });
        current = parent.from;
        currentRound -= 1;
    }

    return null;
}

type RideLeg = Extract<Leg, { kind: 'ride' }>;

const ridesOf = (itinerary: Itinerary) =>
    itinerary.legs.filter((leg): leg is RideLeg => leg.kind === 'ride');

/** Параллельные направления для поездки: те же остановки посадки и выхода, не намного больше остановок. */
function fillAlternatives(graph: Graph, leg: RideLeg) {
    const stopsCount = leg.alightIndex - leg.boardIndex;
    const found: RideLeg['alternatives'] = [
        { pattern: leg.pattern, boardIndex: leg.boardIndex, alightIndex: leg.alightIndex },
    ];

    graph.stopPatterns.get(leg.from)?.forEach(([patternIndex, boardIndex]) => {
        const pattern = graph.patterns[patternIndex];
        if (
            pattern === leg.pattern ||
            found.some((item) => item.pattern.routeId === pattern.routeId)
        )
            return;
        const alightIndex = pattern.stops.indexOf(leg.to, boardIndex + 1);
        if (alightIndex > 0 && alightIndex - boardIndex <= stopsCount + 2) {
            found.push({ pattern, boardIndex, alightIndex });
        }
    });

    leg.alternatives = found;
}

// Одинаковые по остановкам варианты (разными параллельными маршрутами) - это один вариант.
const signature = (itinerary: Itinerary) =>
    ridesOf(itinerary)
        .map((leg) => `${leg.from}-${leg.to}`)
        .join('>');

/** Пересадка должна окупаться: при сравнении каждая стоит столько минут. */
const TRANSFER_WEIGHT_MIN = 7;
const score = (itinerary: Itinerary) =>
    itinerary.estimatedMinutes + TRANSFER_WEIGHT_MIN * Math.max(0, itinerary.rides - 1);

/**
 * Несколько разных вариантов: после каждого поиска запрещаем маршруты самой долгой поездки
 * лучшего варианта (вместе с параллельными) и ищем снова.
 */
export function planJourneys(
    graph: Graph,
    fromId: number,
    toId: number,
    maxOptions = 4,
    maxRides = MAX_RIDES,
): Itinerary[] {
    if (fromId === toId) return [];

    const found = new Map<string, Itinerary>();
    const banned = new Set<number>();

    for (let attempt = 0; attempt < 6 && found.size < maxOptions + 2; attempt += 1) {
        const itineraries = search(graph, fromId, toId, { bannedRoutes: banned, maxRides });
        if (!itineraries.length) break;

        itineraries.forEach((itinerary) => {
            ridesOf(itinerary).forEach((leg) => fillAlternatives(graph, leg));
            const key = signature(itinerary);
            if (!found.has(key)) found.set(key, itinerary);
        });

        const main = itineraries.reduce((a, b) => (score(a) <= score(b) ? a : b));
        const longest = ridesOf(main).sort((a, b) => b.minutes - a.minutes)[0];
        if (!longest) break;
        longest.alternatives.forEach(({ pattern }) => banned.add(pattern.routeId));
    }

    // Близко - можно и пешком. Прямая связь есть, только если места рядом (см. walks).
    const direct = graph.walks.get(fromId)?.find((walk) => walk.to === toId);
    if (direct) {
        found.set('walk', {
            legs: [
                {
                    kind: 'walk',
                    from: fromId,
                    to: toId,
                    minutes: direct.minutes,
                    meters: direct.meters,
                },
            ],
            estimatedMinutes: direct.minutes,
            rides: 0,
        });
    }

    const sorted = Array.from(found.values()).sort((a, b) => score(a) - score(b));
    const bestScore = sorted.length ? score(sorted[0]) : 0;

    // Варианты намного хуже лучшего только загромождают список.
    return sorted.filter((itinerary) => score(itinerary) <= bestScore + 25).slice(0, maxOptions);
}
