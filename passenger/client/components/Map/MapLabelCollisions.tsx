import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Подписи объектов на карте (постоянные Tooltip у остановок и вокзалов) не знают друг о
 * друге: у вокзала и соседних остановок подписи ложились текстом друг на друга, у пары
 * одноимённых остановок по разные стороны улицы
 * название писалось дважды. После каждого сдвига/масштаба и смены набора подписей прячем
 * те, что налезают на более важные, - значок остаётся, пропадает только текст.
 *
 * Важность: выбранная остановка > вокзалы и аэропорт > остановки.
 */
const PRIORITY: [RegExp, number][] = [
    [/MapStopsItemLabel_active/, 0],
    [/MapLabel_(rail|airport|other)/, 1],
];
const DEFAULT_PRIORITY = 3; // остановки
const GAP = 2;

const priorityOf = (element: Element) =>
    PRIORITY.find(([pattern]) => pattern.test(element.className))?.[1] ?? DEFAULT_PRIORITY;

export function MapLabelCollisions() {
    const map = useMap();

    useEffect(() => {
        // Подпись лежит в панели своего маркера (stops, rail), а не в tooltipPane.
        const pane = map.getPane('mapPane');
        if (!pane) return undefined;
        let frame = 0;

        const resolve = () => {
            frame = 0;
            const size = map.getContainer().getBoundingClientRect();
            const labels = Array.from(pane.querySelectorAll<HTMLElement>('.leaflet-tooltip'))
                .map((element) => {
                    // Скрытую прошлым проходом подпись меряем как есть: visibility не меняет размеры.
                    const rect = element.getBoundingClientRect();
                    return { element, rect, priority: priorityOf(element) };
                })
                .filter(({ rect }) => rect.width > 0)
                .sort((a, b) => a.priority - b.priority);

            const placed: DOMRect[] = [];
            labels.forEach(({ element, rect }) => {
                const outside =
                    rect.right < size.left ||
                    rect.left > size.right ||
                    rect.bottom < size.top ||
                    rect.top > size.bottom;
                const overlaps =
                    !outside &&
                    placed.some(
                        (other) =>
                            rect.left < other.right + GAP &&
                            rect.right + GAP > other.left &&
                            rect.top < other.bottom + GAP &&
                            rect.bottom + GAP > other.top,
                    );
                element.style.visibility = overlaps ? 'hidden' : '';
                if (!overlaps && !outside) placed.push(rect);
            });
        };

        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(resolve);
        };

        // Набор подписей меняется без событий карты: прореживание, выбор остановки, слои.
        const observer = new MutationObserver(schedule);
        observer.observe(pane, { childList: true, subtree: true });
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
