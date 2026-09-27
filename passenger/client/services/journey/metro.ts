import { fetchSingle, loadCollection } from 'api/ekb/collections';

/**
 * Метро в поиске маршрута. В данных у метро нет своего route_stops: есть порядок станций
 * по направлениям (metro/lines), координаты станций и входов, расписание выходных по
 * станциям и интервалы движения по часам (metro/schedule_info). Из этого собирается ещё
 * одно «направление» для поиска - см. addMetro в planner.ts.
 *
 * Станции живут в графе с отрицательными id (-station_id), чтобы не пересечься с id
 * наземных остановок.
 */

export interface MetroData {
    color: string;
    lineId: number;
    lineNumber: string;
    stations: { id: number; name: string; lat: number; lng: number }[];
    /** number - номер входа, как на указателях у станции. */
    entrances: { stationId: number; number: number | null; lat: number; lng: number }[];
    directions: { id: number; terminus: string; stationIds: number[] }[];
    /** Минуты между соседними станциями по расписанию: `${из}>${в}` (названия). */
    hopMinutes: Map<string, number>;
    /** Отправления по выходным: `${станция}>${конечная}` -> минуты от полуночи (после полуночи > 1440). */
    weekend: Map<string, number[]>;
    intervals: { будни: MetroInterval[]; выходные: MetroInterval[] };
}

interface MetroInterval {
    from: number;
    to: number;
    /** Средний интервал, минуты. */
    minutes: number;
}

interface LinesRecord {
    line: { id: number; number: string; color?: string };
    directions: {
        direction_id: number;
        terminus_station: string;
        stations: { order: number; station_id: number; station_name: string }[];
    }[];
}

interface ScheduleInfoRecord {
    intervals_weekday_min: IntervalRecord[];
    intervals_weekend_min: IntervalRecord[];
}

interface IntervalRecord {
    from: string;
    to: string;
    interval_seconds_min: number;
    interval_seconds_max: number;
}

const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

// Поезда ходят и после полуночи - «00:05» это конец текущих суток, а не их начало.
const serviceMinutes = (time: string) => {
    const value = toMinutes(time);
    return value < 4 * 60 ? value + 24 * 60 : value;
};

const toIntervals = (records: IntervalRecord[] = []): MetroInterval[] =>
    records.map((record) => ({
        from: toMinutes(record.from),
        to: toMinutes(record.to),
        minutes: (record.interval_seconds_min + record.interval_seconds_max) / 2 / 60,
    }));

let metroPromise: Promise<MetroData | null> | null = null;

/** Данные метро для поиска. null - если не загрузились: маршрут строится без метро. */
export function loadMetroData(): Promise<MetroData | null> {
    if (!metroPromise) {
        metroPromise = Promise.all([
            fetchSingle<LinesRecord>('metro/lines'),
            loadCollection<{ id: number; name: string; lat: number; lng: number }>(
                'metro/stations',
            ),
            loadCollection<{
                station_id: number;
                entrance_number: number | null;
                lat: number;
                lng: number;
            }>('metro/entrances'),
            loadCollection<{ station: string; direction_to: string; time: string }>(
                'metro/weekend_schedule',
            ),
            fetchSingle<ScheduleInfoRecord>('metro/schedule_info'),
        ])
            .then(([lines, stations, entrances, weekendRows, info]) => {
                if (!lines || !stations.length) return null;

                const weekend = new Map<string, number[]>();
                weekendRows.forEach((row) => {
                    const key = `${row.station}>${row.direction_to}`;
                    const list = weekend.get(key) ?? [];
                    list.push(serviceMinutes(row.time));
                    weekend.set(key, list);
                });
                weekend.forEach((list) => list.sort((a, b) => a - b));

                const directions = lines.directions.map((direction) => {
                    const ordered = [...direction.stations].sort((a, b) => a.order - b.order);
                    return {
                        id: direction.direction_id,
                        terminus: direction.terminus_station,
                        stationIds: ordered.map((station) => station.station_id),
                        names: ordered.map((station) => station.station_name),
                    };
                });

                // Время перегона - медиана разницы между отправлением поезда со станции и
                // ближайшим следующим отправлением с соседней. На конечной отправлений в эту
                // сторону нет - последний перегон оценивается по расстоянию (см. planner.ts).
                const hopMinutes = new Map<string, number>();
                directions.forEach(({ terminus, names }) => {
                    for (let i = 0; i + 1 < names.length; i += 1) {
                        const from = weekend.get(`${names[i]}>${terminus}`) ?? [];
                        const to = weekend.get(`${names[i + 1]}>${terminus}`) ?? [];
                        const diffs: number[] = [];
                        from.forEach((time) => {
                            const next = to.find((candidate) => candidate > time);
                            if (next !== undefined) diffs.push(next - time);
                        });
                        if (!diffs.length) continue;
                        diffs.sort((a, b) => a - b);
                        const median = diffs[Math.floor(diffs.length / 2)];
                        if (median > 0 && median < 10)
                            hopMinutes.set(`${names[i]}>${names[i + 1]}`, median);
                    }
                });

                return {
                    color: lines.line.color || '#1c8c3a',
                    lineId: lines.line.id,
                    lineNumber: lines.line.number,
                    stations,
                    entrances: entrances.map((entrance) => ({
                        stationId: entrance.station_id,
                        number: entrance.entrance_number ?? null,
                        lat: entrance.lat,
                        lng: entrance.lng,
                    })),
                    directions: directions.map(({ id, terminus, stationIds }) => ({
                        id,
                        terminus,
                        stationIds,
                    })),
                    hopMinutes,
                    weekend,
                    intervals: {
                        будни: toIntervals(info?.intervals_weekday_min),
                        выходные: toIntervals(info?.intervals_weekend_min),
                    },
                };
            })
            .catch((error) => {
                console.warn('Метро в поиске маршрута недоступно', error);
                metroPromise = null;
                return null;
            });
    }
    return metroPromise;
}

/**
 * Ближайший поезд со станции в сторону конечной не раньше after. В выходные - по точному
 * расписанию, в будни - по интервалу движения (ожидание - половина интервала: момент
 * прихода поезда неизвестен). 'none' - метро уже закрыто.
 */
export function nextMetroDeparture(
    metro: MetroData,
    stationName: string,
    terminus: string,
    dayType: 'будни' | 'выходные',
    after: number,
): { time: number; source: 'schedule' | 'interval' } | 'none' {
    if (dayType === 'выходные') {
        const times = metro.weekend.get(`${stationName}>${terminus}`);
        if (times?.length) {
            const next = times.find((time) => time >= after);
            return next === undefined ? 'none' : { time: next, source: 'schedule' };
        }
    }

    const intervals = metro.intervals[dayType];
    if (!intervals.length) return { time: after + 5, source: 'interval' };

    if (after < intervals[0].from) return { time: intervals[0].from, source: 'interval' };
    const current = intervals.find(({ from, to }) => after >= from && after < to);
    if (!current) return 'none';
    return { time: after + current.minutes / 2, source: 'interval' };
}
