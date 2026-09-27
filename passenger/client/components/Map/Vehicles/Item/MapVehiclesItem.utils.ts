import {
    ANIMATION_INTERVAL,
    METERS_IN_KILOMETER,
    SECONDS_IN_HOUR,
} from './MapVehiclesItem.constants';
import { MoveInDirectionParams } from './MapVehiclesItem.types';
import L from 'leaflet';
import { prefersReducedMotion } from 'utils/reducedMotion';

// Ключ - vehicle.id, DOM id элемента маркера ("vehicle-{id}-{num}", строка, а не число -
// аннотация ниже была неверна и раньше).
const intervalById: {
    [id: string]: ReturnType<typeof setInterval>;
} = {};

function round(num: number, decimalPlaces: number = 0) {
    const multyplier = 10 ** decimalPlaces;

    return Math.round((num + Number.EPSILON) * multyplier) / multyplier;
}

function getDeltaCoords(velocity: number, course: number) {
    const distance = (velocity * ANIMATION_INTERVAL) / 1000;
    const angleInRad = (course * Math.PI) / 180;

    // Calculating cathets (x and y) from hypotenuse (distance)
    return [round(Math.sin(angleInRad) * distance, 4), -round(Math.cos(angleInRad) * distance, 4)];
}

function getVelocityInPixelsPerSecond(velocity: number, scale: number) {
    const velocityMetersPerSecond = (velocity * METERS_IN_KILOMETER) / SECONDS_IN_HOUR;

    return velocityMetersPerSecond / scale;
}

function moveInDirection({ direction, vehicle, velocity, scale }: MoveInDirectionParams) {
    const currentCoords = vehicle.style.transform.match(
        /translate3d\((-?[.0-9]+)px, (-?[.0-9]+)px, 0px\)/,
    );

    let x = currentCoords ? Number(currentCoords[1]) : 0;
    let y = currentCoords ? Number(currentCoords[2]) : 0;

    const velocityPxPerSecond = getVelocityInPixelsPerSecond(velocity, scale);
    const [deltaX, deltaY] = getDeltaCoords(velocityPxPerSecond, direction);

    x += deltaX;
    y += deltaY;

    vehicle.style.transform = `translate3d(${x}px, ${y}px, 0px)`;
}

export function startMoveInDirection({
    direction,
    vehicle,
    velocity,
    scale,
}: MoveInDirectionParams) {
    stopMoveInterval(vehicle.id);

    // «Уменьшить движение»: машина не ползёт между опросами, а переставляется раз в 30 с.
    if (prefersReducedMotion()) {
        return;
    }

    intervalById[vehicle.id] = setInterval(
        () =>
            moveInDirection({
                direction,
                vehicle,
                velocity,
                scale,
            }),
        ANIMATION_INTERVAL,
    );
}

export function commitMoveOffset({
    map,
    marker,
    vehicle,
}: {
    map: L.Map;
    marker: L.Marker;
    vehicle: HTMLElement;
}) {
    stopMoveInterval(vehicle.id);

    const currentCoords = vehicle.style.transform.match(
        /translate3d\((-?[.0-9]+)px, (-?[.0-9]+)px, 0px\)/,
    );
    const offsetX = currentCoords ? Number(currentCoords[1]) : 0;
    const offsetY = currentCoords ? Number(currentCoords[2]) : 0;

    if (offsetX || offsetY) {
        const point = map.latLngToLayerPoint(marker.getLatLng()).add(L.point(offsetX, offsetY));
        marker.setLatLng(map.layerPointToLatLng(point));
    }

    vehicle.style.transform = 'translate3d(0px, 0px, 0px)';
}

// Раньше называлась clearIntervals() и чистила ВСЕ интервалы разом (intervalById - общий на
// весь модуль, по одному на каждую видимую машину). Вызывалась из componentWillUnmount
// каждого отдельно взятого маркера - то есть уход с карты любой одной машины (уехала за
// bounds, отфильтровалась при выборе маршрута) останавливал интерполяцию движения у ВСЕХ
// остальных, и они замирали до следующего обновления координат раз в 30с. Теперь чистит
// только интервал конкретного маркера по его DOM id.
export function stopMoveInterval(vehicleElementId: string) {
    if (intervalById[vehicleElementId] === undefined) {
        return;
    }

    clearInterval(intervalById[vehicleElementId]);
    delete intervalById[vehicleElementId];
}
