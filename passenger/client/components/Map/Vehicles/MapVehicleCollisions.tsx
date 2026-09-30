import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const GAP = 2;

type Box = { left: number; top: number; right: number; bottom: number };

const overlaps = (a: Box, b: Box) =>
    a.left < b.right + GAP && a.right + GAP > b.left && a.top < b.bottom + GAP && a.bottom + GAP > b.top;

/**
 * Бейджи машин (номер, низкий пол) не должны ложиться на чужие капли и на бейджи машин южнее -
 * те нарисованы поверх (z-index Leaflet по широте). В плотном месте номера одних машин
 * закрывали капли других, и маркеры сливались в кашу. Налезающие бейджи прячем - у машины
 * остаётся капля с пиктограммой, как у подписей остановок (MapLabelCollisions). Так же делают
 * приложения (VehicleLayer).
 */
export function MapVehicleCollisions() {
    const map = useMap();

    useEffect(() => {
        // Машины - в своей панели (Pane "vehicles" в MapTransport); она появляется вместе с
        // данными, поэтому следим за всей картой и ищем маркеры при каждом пересчёте.
        const pane = map.getPane('mapPane');
        if (!pane) return undefined;
        let frame = 0;

        const resolve = () => {
            frame = 0;
            const markers = Array.from(pane.querySelectorAll<HTMLElement>('.leaflet-vehicles-pane [id^="vehicle-"]'))
                .map((element) => {
                    const info = element.querySelector<HTMLElement>('[class*="MapVehicleMarkerInfo"]');
                    const icon = element.querySelector<HTMLElement>('[class*="MapVehicleMarkerIcon"]');
                    if (!info || !icon) return null;
                    const iconRect = icon.getBoundingClientRect();
                    // Капля - круг вокруг пиктограммы (остриё крутится - берём круг с запасом).
                    const cx = iconRect.left + iconRect.width / 2;
                    const cy = iconRect.top + iconRect.height / 2;
                    const r = iconRect.width * 0.72;
                    const drop = { left: cx - r, top: cy - r, right: cx + r, bottom: cy + r };
                    return { info, drop, badges: info.getBoundingClientRect(), y: cy };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null && item.badges.width > 0);

            // Южнее - поверх, их бейджи важнее.
            const order = [...markers].sort((a, b) => b.y - a.y);
            const taken: Box[] = [];
            order.forEach((item) => {
                const hit =
                    markers.some((other) => other !== item && overlaps(other.drop, item.badges)) ||
                    taken.some((box) => overlaps(box, item.badges));
                // Меняем только при смене: своя правка стиля тоже будит наблюдателя.
                const visibility = hit ? 'hidden' : '';
                if (item.info.style.visibility !== visibility) item.info.style.visibility = visibility;
                if (!hit) taken.push(item.badges);
            });
        };

        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(resolve);
        };

        // Машины двигаются и пересоздаются без событий карты: обновление позиций, фильтры.
        const observer = new MutationObserver(schedule);
        observer.observe(pane, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
        map.on('zoomend moveend resize', schedule);
        schedule();

        return () => {
            observer.disconnect();
            map.off('zoomend moveend resize', schedule);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, [map]);

    return null;
}
