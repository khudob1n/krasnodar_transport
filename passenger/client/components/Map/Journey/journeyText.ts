import { walkTarget } from 'services/journey/doorToDoor';
import { Graph, isMetroStop, isPlaceId } from 'services/journey/planner';
import { PlannedLeg } from 'services/journey/schedule';

/** Подписи и форматирование шагов маршрута - общие для списка вариантов и навигатора. */

export type WalkLeg = Extract<PlannedLeg, { kind: 'walk' }>;
export type RideLeg = Extract<PlannedLeg, { kind: 'ride' }>;

export const TYPE_NOMINATIVE = {
    tram: 'Трамвай',
    troll: 'Троллейбус',
    bus: 'Автобус',
    metro: 'Метро',
} as const;

export const plural = (n: number, one: string, few: string, many: string) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
};

export const formatDuration = (minutes: number) => {
    const total = Math.max(1, Math.round(minutes));
    if (total < 60) return `${total} мин`;
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
};

export const formatMeters = (meters: number) =>
    meters < 1000
        ? `${Math.max(10, Math.round(meters / 10) * 10)} м`
        : `${(meters / 1000).toFixed(1).replace('.', ',')} км`;

export const stopsWord = (leg: RideLeg, count: number) =>
    leg.chosen.type === 'metro'
        ? plural(count, 'станция', 'станции', 'станций')
        : plural(count, 'остановка', 'остановки', 'остановок');

export const SOURCE_NOTE: Record<RideLeg['source'], string> = {
    schedule: 'по расписанию',
    interval: 'по интервалу движения',
    estimate: 'примерно, расписания нет',
};

/** Вход метро на пешем шаге - ближайший к другому его концу, до него же нарисована линия. */
export function entranceOf(graph: Graph | null, leg: WalkLeg) {
    if (!graph) return null;
    const metroId = [leg.to, leg.from].find(isMetroStop);
    if (metroId === undefined) return null;
    const other = graph.stops.get(metroId === leg.to ? leg.from : leg.to);
    return other ? (walkTarget(graph, metroId, other)?.number ?? null) : null;
}

// Вход дальше этого от центра платформы вдоль пути - у одного из её концов. Ближе - выход
// из середины платформы или неясно, к какому концу он ведёт: подсказку не даём.
const METRO_EXIT_END_MIN_M = 40;

/**
 * Где садиться в метро, чтобы на станции выхода оказаться у нужного выхода: в начале поезда
 * или в конце. Точка станции - центр платформы (в OSM точки остановки поезда в обе стороны
 * стоят там же), направление движения - от предыдущей станции к станции выхода. Вход в
 * город берётся тот же, что и в следующем пешем шаге (ближайший к месту назначения).
 * null - если выход из метро не пешком, у станции нет входов или конец платформы неясен.
 */
export function metroCarHint(
    graph: Graph | null,
    legs: PlannedLeg[],
    index: number,
): { end: 'head' | 'tail'; entrance: number | null } | null {
    const leg = legs[index];
    const next = legs[index + 1];
    if (!graph || leg?.kind !== 'ride' || leg.chosen.type !== 'metro') return null;
    if (next?.kind !== 'walk' || next.from !== leg.to) return null;

    const station = graph.stops.get(leg.to);
    const previous = graph.stops.get(leg.chosen.stops[leg.chosenAlightIndex - 1]);
    const other = graph.stops.get(next.to);
    if (!station || !previous || !other) return null;
    const exit = walkTarget(graph, leg.to, other);
    if (!exit || exit === station) return null;

    // Плоские метры около станции - на длине платформы кривизной Земли можно пренебречь.
    const kx = 111_320 * Math.cos((station.lat * Math.PI) / 180);
    const ky = 110_540;
    const axisX = (station.lng - previous.lng) * kx;
    const axisY = (station.lat - previous.lat) * ky;
    const axisLength = Math.hypot(axisX, axisY);
    if (!axisLength) return null;
    const along =
        ((exit.lng - station.lng) * kx * axisX + (exit.lat - station.lat) * ky * axisY) /
        axisLength;
    if (Math.abs(along) < METRO_EXIT_END_MIN_M) return null;

    return {
        end: along > 0 ? 'head' : 'tail',
        entrance: 'number' in exit ? (exit.number ?? null) : null,
    };
}

/** Подсказка про вагон: «Первый вагон» и «ближе к выходу № 3» (пробелы у номера неразрывные). */
export const metroCarText = (hint: { end: 'head' | 'tail'; entrance: number | null }) => ({
    title: hint.end === 'head' ? 'Первый вагон' : 'Последний вагон',
    note: `ближе к выходу${hint.entrance ? `\u00a0№\u00a0${hint.entrance}` : ''}`,
});

/**
 * Текст пешего шага: к остановке, на ту же остановку напротив, к метро или из метро.
 * entrance - номер входа метро на этом шаге, если известен.
 */
export function walkText(
    leg: WalkLeg,
    isFirst: boolean,
    isLast: boolean,
    nameOf: (id: number) => string,
    entrance?: number | null,
) {
    const distance = formatMeters(leg.meters);
    const from = nameOf(leg.from);
    const to = nameOf(leg.to);
    const target = (name: string) => (isLast ? `до «${name}»` : `к остановке «${name}»`);
    const exit = entrance ? ` через выход № ${entrance}` : '';

    if (isMetroStop(leg.to)) {
        const door = entrance ? `до входа № ${entrance} метро` : 'до метро';
        return `Пешком ${distance} ${door} «${to}» и спуститесь к платформе`;
    }
    // Маршрут начинается на станции - пассажир ещё не в метро, выходить неоткуда.
    if (isMetroStop(leg.from) && isFirst) {
        return `От метро «${from}»${exit ? ` (выход № ${entrance})` : ''} пешком ${distance} ${target(to)}`;
    }
    if (isMetroStop(leg.from)) {
        return `Поднимитесь из метро «${from}»${exit} и пройдите ${distance} ${target(to)}`;
    }
    if (isLast && isPlaceId(leg.to)) return `Пешком ${distance} до «${to}»`;
    if (isPlaceId(leg.from)) return `Пешком ${distance} к остановке «${to}»`;
    if (from === to) {
        return leg.meters < 150
            ? `Перейдите на остановку «${to}» напротив — ${distance}`
            : `Пешком ${distance} к другой остановке «${to}»`;
    }
    return `Пешком ${distance} ${isLast ? 'до' : 'к остановке'} «${to}»`;
}
