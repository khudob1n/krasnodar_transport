import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

import { flyToVisible, visibleCenter } from 'components/Map/mapViewport';

const FOLLOW_INTERVAL_MS = 1500;
/** Масштаб при включении наблюдения - близко, чтобы было видно, как машина едет по улице.
 *  Если карта уже приближена сильнее, не отдаляем. */
const FOLLOW_ZOOM = 17;

/**
 * Режим «Наблюдать за движением» (TASK-209): карта приближается к машине и держит её в центре. Берём положение DOM-элемента
 * маркера, а не координаты из данных - между опросами (раз в 30 с) машина плавно едет за счёт
 * transform, и слежка идёт вместе с ней. Любое перетаскивание карты пользователем режим
 * выключает, чтобы не бороться с ним за камеру.
 */
export function useFollowVehicle(elementId: string, enabled: boolean, onStop: () => void) {
    const map = useMap();

    useEffect(() => {
        if (!enabled) return undefined;

        const markerPoint = () => {
            const element = document.getElementById(elementId);
            if (!element) return null;

            const rect = element.getBoundingClientRect();
            const container = map.getContainer().getBoundingClientRect();
            return map.containerPointToLatLng([
                rect.left + rect.width / 2 - container.left,
                rect.top + rect.height / 2 - container.top,
            ]);
        };

        const follow = () => {
            const point = markerPoint();
            // Машина - в середине видимой части, а не под карточкой машины.
            if (point) map.panTo(visibleCenter(map, point), { animate: true, duration: 0.6 });
        };

        let interval: ReturnType<typeof setInterval> | undefined;
        const startFollowing = () => {
            follow();
            interval = setInterval(follow, FOLLOW_INTERVAL_MS);
        };

        // Сначала подлетаем к машине крупнее, слежка - после приземления: её panTo раз в
        // полторы секунды оборвал бы перелёт.
        const point = markerPoint();
        if (point && map.getZoom() < FOLLOW_ZOOM) {
            map.once('moveend', startFollowing);
            flyToVisible(map, point, FOLLOW_ZOOM, { duration: 0.8 });
        } else {
            startFollowing();
        }
        map.on('dragstart', onStop);

        return () => {
            map.off('moveend', startFollowing);
            clearInterval(interval);
            map.off('dragstart', onStop);
        };
    }, [elementId, enabled, map, onStop]);
}
