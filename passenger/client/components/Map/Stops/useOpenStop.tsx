import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useMap } from 'react-leaflet';

import { store } from 'state';
import { setCurrentStop } from 'state/features/public-transport';
import { sidebarService } from 'services/sidebar/sidebar';
import { State } from 'common/types/state';
import { MapStopsSidebar } from 'components/Map/Stops/Sidebar/MapStopsSidebar';
import { LABELS_MINIMAL_ZOOM } from 'components/Map/mapDensity';
import { flyToVisible } from 'components/Map/mapViewport';

/**
 * Выбрать остановку: выделить, перелететь к ней и открыть карточку. Общее для поиска,
 * избранного, списка «Рядом» и ссылок на остановку. Возвращает false, если остановки нет
 * в загруженных данных.
 */
export function useOpenStop() {
    const dispatch = useDispatch<typeof store.dispatch>();
    const map = useMap();
    const allStops = useSelector((state: State) => state.publicTransport.stops);

    return useCallback(
        (stopId: string): boolean => {
            const stop = allStops?.find(
                (stopFullData) => stopFullData.attributes.stopId === stopId,
            );

            if (!stop) {
                return false;
            }

            const { attributes: stopData } = stop;

            dispatch(setCurrentStop({ currentStop: stopId }));

            // Не мельче масштаба, с которого у остановок видны подписи: на 15-м они прорежены,
            // и выбранная остановка терялась среди соседних без названия.
            // В середину видимой части - не под карточку.
            flyToVisible(map, stopData.coords, Math.max(map.getZoom(), LABELS_MINIMAL_ZOOM + 1));

            sidebarService.open({
                component: (
                    <MapStopsSidebar type={stopData.type} name={stopData.title} stopId={stopId} />
                ),
                onClose: () => dispatch(setCurrentStop(null)),
            });

            return true;
        },
        [dispatch, allStops, map],
    );
}
