import L from 'leaflet';

type LabelStop = {
    id: string;
    name: string;
    coords: [number, number];
    isActive: boolean;
};

type LabelBox = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

const normalizeStopName = (name: string) =>
    name.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');

const boxesIntersect = (first: LabelBox, second: LabelBox, padding: number) =>
    first.left < second.right + padding &&
    first.right + padding > second.left &&
    first.top < second.bottom + padding &&
    first.bottom + padding > second.top;

/**
 * Возвращает id физических остановок, возле которых следует нарисовать подпись.
 * Близкие одноимённые точки образуют один остановочный узел; затем подписи разных узлов,
 * которые пересеклись бы на экране, прореживаются. Активная остановка всегда приоритетна.
 */
export function selectStopLabelIds(
    stops: LabelStop[],
    map: L.Map,
    groupRadiusMeters: number,
    collisionPaddingPx: number,
): Set<string> {
    const stopsByName = new Map<string, LabelStop[]>();

    stops.forEach((stop) => {
        const normalizedName = normalizeStopName(stop.name);
        const sameNameStops = stopsByName.get(normalizedName) || [];

        sameNameStops.push(stop);
        stopsByName.set(normalizedName, sameNameStops);
    });

    const representatives: LabelStop[] = [];

    stopsByName.forEach((sameNameStops) => {
        const unvisited = new Set(sameNameStops.map((stop) => stop.id));

        while (unvisited.size) {
            const firstId = unvisited.values().next().value as string;
            const queue = [sameNameStops.find((stop) => stop.id === firstId)!];
            const group: LabelStop[] = [];
            unvisited.delete(firstId);

            while (queue.length) {
                const current = queue.pop()!;
                group.push(current);

                sameNameStops.forEach((candidate) => {
                    if (
                        unvisited.has(candidate.id) &&
                        map.distance(current.coords, candidate.coords) <= groupRadiusMeters
                    ) {
                        unvisited.delete(candidate.id);
                        queue.push(candidate);
                    }
                });
            }

            const activeStop = group.find((stop) => stop.isActive);
            if (activeStop) {
                representatives.push(activeStop);
                continue;
            }

            const center = group.reduce(
                (result, stop) => ({
                    lat: result.lat + stop.coords[0] / group.length,
                    lng: result.lng + stop.coords[1] / group.length,
                }),
                { lat: 0, lng: 0 },
            );

            representatives.push(
                group.reduce((closest, stop) =>
                    map.distance(stop.coords, center) < map.distance(closest.coords, center)
                        ? stop
                        : closest,
                ),
            );
        }
    });

    representatives.sort((first, second) => {
        if (first.isActive !== second.isActive) return first.isActive ? -1 : 1;
        return first.id.localeCompare(second.id, 'ru', { numeric: true });
    });

    const visibleLabelIds = new Set<string>();
    const occupiedBoxes: LabelBox[] = [];

    representatives.forEach((stop) => {
        const point = map.latLngToContainerPoint(stop.coords);
        const markerOffset = stop.isActive ? 27 : 15;
        // Onest 13/16: средняя ширина кириллического символа около 7px.
        const width = Math.max(36, stop.name.length * 7 + 8);
        const box = {
            left: point.x + markerOffset,
            right: point.x + markerOffset + width,
            top: point.y - 11,
            bottom: point.y + 11,
        };

        if (
            stop.isActive ||
            !occupiedBoxes.some((occupied) => boxesIntersect(box, occupied, collisionPaddingPx))
        ) {
            visibleLabelIds.add(stop.id);
            occupiedBoxes.push(box);
        }
    });

    return visibleLabelIds;
}
