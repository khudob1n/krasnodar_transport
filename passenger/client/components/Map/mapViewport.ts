import L from 'leaflet';

/**
 * Видимая часть карты, когда открыта карточка: на компьютере слева - панель шириной ~460px
 * (MapMainContainer: отступ 12px + 448px), на телефоне снизу - шторка на полэкрана
 * (Sidepage_halfOpen), сверху - поиск и кнопки. Перелёты к объекту и границам маршрута
 * должны целиться в эту часть, а не в центр всей карты - иначе объект уходит под панель.
 */
export function sidebarPadding(map: L.Map) {
    const { x: width, y: height } = map.getSize();
    const wide = width > 768;
    return {
        paddingTopLeft: L.point(wide ? [480, 90] : [30, 90]),
        paddingBottomRight: L.point(wide ? [80, 40] : [30, Math.round(height * 0.5)]),
    };
}

/** Центр карты, при котором point окажется в середине видимой части на масштабе zoom. */
export function visibleCenter(map: L.Map, point: L.LatLngExpression, zoom = map.getZoom()) {
    const { x: width, y: height } = map.getSize();
    const { paddingTopLeft, paddingBottomRight } = sidebarPadding(map);
    const offset = L.point(
        (paddingTopLeft.x - paddingBottomRight.x) / 2,
        (paddingTopLeft.y - paddingBottomRight.y) / 2,
    );
    // Свободная область меньше отступов (очень маленькое окно) - просто центр.
    if (
        paddingTopLeft.x + paddingBottomRight.x >= width ||
        paddingTopLeft.y + paddingBottomRight.y >= height
    ) {
        return L.latLng(point);
    }
    return map.unproject(map.project(point, zoom).subtract(offset), zoom);
}

/** flyTo, но объект - в середине видимой части, а не под панелью. */
export function flyToVisible(
    map: L.Map,
    point: L.LatLngExpression,
    zoom = map.getZoom(),
    options?: L.ZoomPanOptions,
) {
    map.flyTo(visibleCenter(map, point, zoom), zoom, options);
}

/** flyToBounds с отступами под панель. */
export function flyToBoundsVisible(
    map: L.Map,
    bounds: L.LatLngBoundsExpression,
    options?: L.FitBoundsOptions,
) {
    map.flyToBounds(bounds, { ...sidebarPadding(map), ...options });
}
