import 'leaflet';

declare module 'leaflet' {
    // Leaflet кладёт bubblingMouseEvents в Layer.options, то есть опция работает у любого слоя,
    // включая Tooltip с interactive. Но @types/leaflet объявляет её только в
    // InteractiveLayerOptions, а TooltipOptions наследуется от DivOverlayOptions и до неё не
    // достаёт - отсюда это дополнение. Нужна в MapStopsItem: без неё клик по подписи остановки
    // всплывает до карты (см. Map._findEventTargets - контейнер карты тоже попадает в цели) и
    // useMapEvent('click') в MapTransport закрывает только что открытую карточку.
    interface TooltipOptions {
        bubblingMouseEvents?: boolean | undefined;
    }
}
