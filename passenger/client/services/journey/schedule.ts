import { fetchStopSchedule, StopSchedule } from 'api/ekb/collections';

import { nextMetroDeparture } from './metro';
import { Graph, Itinerary, Leg, Pattern } from './planner';

/**
 * Подставляет в найденный вариант реальные отправления по расписанию остановок: к каждой
 * посадке ищется ближайший рейс после того, как пассажир дошёл или доехал до остановки.
 * Время в пути - по-прежнему оценка по расстоянию (сопоставить рейс на двух остановках
 * по нашим данным нельзя - у рейсов нет идентификаторов).
 *
 * Расписание есть не у всех остановок. Без него ожидание оценивается, а вариант
 * помечается как приблизительный.
 */

/** Ожидание, если расписания на остановке нет. */
const UNKNOWN_WAIT_MIN = 6;

export type DepartureSource = 'schedule' | 'interval' | 'estimate';

export type PlannedLeg =
    | (Extract<Leg, { kind: 'walk' }> & { start: number; end: number })
    | (Extract<Leg, { kind: 'ride' }> & {
          /** Направление, в которое садимся (из alternatives - с ближайшим рейсом). */
          chosen: Pattern;
          chosenBoardIndex: number;
          chosenAlightIndex: number;
          /** Готов к посадке - дошёл или доехал. */
          ready: number;
          departure: number;
          arrival: number;
          source: DepartureSource;
          /** Сегодня рейсов этого участка больше нет - время отправления условное. */
          noService: boolean;
      });

export interface PlannedJourney {
    itinerary: Itinerary;
    legs: PlannedLeg[];
    /** Всё в минутах от полуночи сегодняшнего дня. */
    start: number;
    arrival: number;
    /** Сегодня по одному из участков рейсов уже нет. */
    noServiceToday: boolean;
    /** Хотя бы одно ожидание оценено без расписания. */
    approximate: boolean;
}

export const dayTypeOf = (date: Date): 'будни' | 'выходные' =>
    [0, 6].includes(date.getDay()) ? 'выходные' : 'будни';

const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export const minutesOfDay = (date: Date) =>
    date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;

export const formatClock = (minutes: number) => {
    const total = Math.round(minutes) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

type Departure = { time: number; source: DepartureSource } | 'none' | null;

/**
 * Ближайшее отправление направления с остановки не раньше after.
 * 'none' - расписание для этого маршрута на остановке есть, но сегодня рейсов больше нет;
 * null - расписания нет вовсе.
 */
function nextDeparture(
    schedule: StopSchedule,
    pattern: Pattern,
    dayType: string,
    after: number,
): Departure {
    const sameRoute = <
        T extends {
            route_type: string;
            route_number: string;
            day_type: string;
            to_station: string;
        },
    >(
        records: T[],
    ) => {
        const ofRoute = records.filter(
            (record) =>
                record.route_type === pattern.routeType &&
                record.route_number === pattern.number &&
                record.day_type === dayType,
        );
        const exact = ofRoute.filter((record) => record.to_station === pattern.directionTo);
        if (exact.length) return exact;
        // Конечная в расписании иногда записана иначе («Западное депо» вместо конечной
        // маршрута). Если на остановке маршрут идёт только в одну сторону - это она.
        return new Set(ofRoute.map((record) => record.to_station)).size === 1 ? ofRoute : [];
    };

    const trips = sameRoute(schedule.trips);
    const intervals = sameRoute(schedule.intervals);
    if (!trips.length && !intervals.length) return null;

    let best: { time: number; source: DepartureSource } | null = null;

    trips.forEach((trip) => {
        const time = toMinutes(trip.time);
        if (time >= after && (!best || time < best.time)) best = { time, source: 'schedule' };
    });

    intervals.forEach((interval) => {
        if (interval.interval_min <= 0) return;
        const start = toMinutes(interval.start_time);
        const end = toMinutes(interval.end_time);
        if (after > end) return;
        const time =
            after <= start
                ? start
                : start +
                  Math.ceil((after - start) / interval.interval_min) * interval.interval_min;
        if (time <= end && (!best || time < best.time)) best = { time, source: 'interval' };
    });

    return best ?? 'none';
}

export async function planSchedule(
    itinerary: Itinerary,
    now: Date,
    graph?: Graph,
): Promise<PlannedJourney> {
    const dayType = dayTypeOf(now);
    const start = minutesOfDay(now);
    let clock = start;
    let noServiceToday = false;
    let approximate = false;
    const legs: PlannedLeg[] = [];

    for (const leg of itinerary.legs) {
        if (leg.kind === 'walk') {
            legs.push({ ...leg, start: clock, end: clock + leg.minutes });
            clock += leg.minutes;
            continue;
        }

        const ready = clock;
        // Метро - по своему расписанию, у станций нет расписания остановок.
        const metro = leg.pattern.type === 'metro' ? graph?.metro : undefined;
        const schedule = metro
            ? { trips: [], intervals: [] }
            : await fetchStopSchedule(leg.from).catch(() => ({
                  trips: [],
                  intervals: [],
              }));
        const options = leg.alternatives.length
            ? leg.alternatives
            : [{ pattern: leg.pattern, boardIndex: leg.boardIndex, alightIndex: leg.alightIndex }];

        let chosen: {
            option: (typeof options)[number];
            departure: number;
            source: DepartureSource;
        } | null = null;
        let allNone = true;

        options.forEach((option) => {
            const found = metro
                ? nextMetroDeparture(
                      metro,
                      graph?.stops.get(leg.from)?.name ?? '',
                      option.pattern.directionTo,
                      dayType,
                      ready,
                  )
                : nextDeparture(schedule, option.pattern, dayType, ready);
            if (found === 'none') return;
            allNone = false;
            const departure = found ? found.time : ready + UNKNOWN_WAIT_MIN;
            const source = found ? found.source : 'estimate';
            const arrival =
                departure +
                option.pattern.cumulative[option.alightIndex] -
                option.pattern.cumulative[option.boardIndex];
            const current = chosen
                ? chosen.departure +
                  chosen.option.pattern.cumulative[chosen.option.alightIndex] -
                  chosen.option.pattern.cumulative[chosen.option.boardIndex]
                : Infinity;
            // Рейс по расписанию надёжнее оценки при равном времени прибытия.
            if (
                arrival < current - 0.5 ||
                (arrival <= current + 0.5 && chosen?.source === 'estimate' && found)
            ) {
                chosen = { option, departure, source };
            }
        });

        const noService = allNone || !chosen;
        if (noService) {
            noServiceToday = true;
            chosen = {
                option: options[0],
                departure: ready + UNKNOWN_WAIT_MIN,
                source: 'estimate',
            };
        }

        const { option, departure, source } = chosen as {
            option: (typeof options)[number];
            departure: number;
            source: DepartureSource;
        };
        if (source === 'estimate') approximate = true;

        const arrival =
            departure +
            option.pattern.cumulative[option.alightIndex] -
            option.pattern.cumulative[option.boardIndex];

        legs.push({
            ...leg,
            chosen: option.pattern,
            chosenBoardIndex: option.boardIndex,
            chosenAlightIndex: option.alightIndex,
            ready,
            departure,
            arrival,
            source,
            noService,
        });
        clock = arrival;
    }

    return { itinerary, legs, start, arrival: clock, noServiceToday, approximate };
}

/** Варианты по времени прибытия; те, где сегодня уже не уехать, - в конце. */
export async function planSchedules(
    itineraries: Itinerary[],
    now = new Date(),
    graph?: Graph,
): Promise<PlannedJourney[]> {
    const planned = await Promise.all(
        itineraries.map((itinerary) => planSchedule(itinerary, now, graph)),
    );

    return planned.sort(
        (a, b) =>
            Number(a.noServiceToday) - Number(b.noServiceToday) ||
            a.arrival +
                3 * Math.max(0, a.itinerary.rides - 1) -
                (b.arrival + 3 * Math.max(0, b.itinerary.rides - 1)),
    );
}
