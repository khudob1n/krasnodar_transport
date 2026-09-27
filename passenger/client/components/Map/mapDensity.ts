// Общая логика прореживания маркеров на маленьком zoom - без кластеризации (она бы рисовала
// иконку не в реальной точке объекта, а в центре группы), просто показываем часть объектов,
// стабильно выбранную по id (не случайно на каждый опрос/рендер - иначе иконки бы мигали),
// и возвращаем все по мере приближения. Используется и для машин (MapVehicles), и для
// остановок (MapStops) - у остановок отдельная, более агрессивная кривая: их на порядок
// больше (~1600 против ~900 машин), и, в отличие от машин, они не редеют сами по себе, когда
// выбран маршрут или остановка.
// С какого zoom на карте появляются подписи - общий порог для остановок, станций метро и
// их входов, ж/д станций, автовокзалов и аэропорта, чтобы названия объектов всех слоёв
// появлялись одновременно, а не вразнобой. Выбран по остановкам: их больше всего, и только
// с 16 они перестают прореживаться (stopSampleRateForZoom) - ниже на экране одновременно
// и прорежённые иконки, и плотная сетка названий, которые всё равно налезли бы друг на друга.
export const LABELS_MINIMAL_ZOOM = 16;

export function vehicleSampleRateForZoom(zoom: number): number {
    if (zoom >= 16) return 1;
    if (zoom >= 15) return 2;
    if (zoom >= 14) return 4;
    return 8;
}

export function stopSampleRateForZoom(zoom: number): number {
    if (zoom >= 16) return 1;
    if (zoom >= 15) return 3;
    if (zoom >= 14) return 8;
    return 16;
}

export function isSampledIn(id: string | number, sampleRate: number): boolean {
    if (sampleRate <= 1) return true;
    const n = typeof id === 'number' ? id : Number(id);
    const key = Number.isFinite(n) ? n : String(id).length;
    return key % sampleRate === 0;
}
