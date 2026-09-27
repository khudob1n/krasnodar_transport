import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useMap } from 'react-leaflet';

import { store } from 'state';
import { setCurrentVehicle } from 'state/features/public-transport';
import { sidebarService } from 'services/sidebar/sidebar';
import { VehicleUnit } from 'api/masstrans/masstrans';
import { flyToVisible } from 'components/Map/mapViewport';

import { MapVehiclesSidebar } from './Sidebar/MapVehiclesSidebar';

/**
 * Открыть карточку машины так же, как по клику на маркер (MapVehiclesItem), и при
 * необходимости перелететь к ней. Нужно для ссылок на машину, где маркера под рукой нет.
 */
export function useOpenVehicle() {
    const dispatch = useDispatch<typeof store.dispatch>();
    const map = useMap();

    return useCallback(
        (vehicle: VehicleUnit, { flyTo = false }: { flyTo?: boolean } = {}) => {
            const { num, routeId, routeDirection, type } = vehicle;

            sidebarService.open({
                component: <MapVehiclesSidebar {...vehicle} warning={vehicle.warning} />,
                onClose: () => dispatch(setCurrentVehicle(null)),
            });

            dispatch(setCurrentVehicle({ num, routeId, routeDirection, type }));

            if (flyTo) flyToVisible(map, vehicle.coords, Math.max(map.getZoom(), 16));
        },
        [dispatch, map],
    );
}
