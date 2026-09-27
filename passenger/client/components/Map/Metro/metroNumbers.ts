export interface MetroLinesData {
    line: { name: string; color?: string };
    directions: {
        terminus_station: string;
        stations: { order: number; station_name: string }[];
    }[];
}

/**
 * Номер станции - её порядок на линии от «Проспекта Космонавтов» (первое направление в
 * metro/lines), как станции нумеруются на схемах: 1 - Проспект Космонавтов ... 9 - Ботаническая.
 * Берём направление, где порядок начинается с северной конечной, а не первое попавшееся,
 * чтобы нумерация не перевернулась, если направления в данных поменяются местами.
 */
export function metroStationNumbers(lines: MetroLinesData | null): Map<string, number> {
    const numbers = new Map<string, number>();
    const direction =
        lines?.directions.find((item) =>
            item.stations.some(
                ({ order, station_name }) => order === 1 && station_name === 'Проспект Космонавтов',
            ),
        ) ?? lines?.directions[0];

    direction?.stations.forEach(({ order, station_name }) => numbers.set(station_name, order));
    return numbers;
}

export const METRO_LINE_COLOR_FALLBACK = '#1c8c3a';
