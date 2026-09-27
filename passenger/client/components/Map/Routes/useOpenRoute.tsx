import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { store } from 'state';
import { RouteSearchItem } from 'api/masstrans/masstrans';
import { setCurrentVehicle } from 'state/features/public-transport';
import { sidebarService } from 'services/sidebar/sidebar';
import { MapRouteSidebar } from 'components/Map/Routes/Sidebar/MapRouteSidebar';

/** Открыть маршрут: линия на карте в основном направлении и карточка маршрута (поиск, избранное). */
export function useOpenRoute() {
    const dispatch = useDispatch<typeof store.dispatch>();

    return useCallback(
        (route: RouteSearchItem) => {
            const primaryDirection = route.directions[0];

            dispatch(
                setCurrentVehicle({
                    num: route.num,
                    routeDirection: primaryDirection.routeDirection,
                    type: route.type,
                    routeId: route.routeId,
                    shouldFlyTo: true,
                    shouldFilterByRouteDirection: true,
                }),
            );

            sidebarService.open({
                component: <MapRouteSidebar {...route} />,
                onClose: () => dispatch(setCurrentVehicle(null)),
            });
        },
        [dispatch],
    );
}
