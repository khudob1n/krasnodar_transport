import React, { useEffect } from 'react';
import { Pane, useMap, useMapEvent } from 'react-leaflet';
import { useDispatch, useSelector } from 'react-redux';

import { ClientUnit } from 'transport-common/types/masstrans';

import { massTransApi } from 'api/masstrans/masstrans';
import { sidebarService } from 'services/sidebar/sidebar';
import { getJourneyState } from 'services/journey/journeyStore';
import { clearCurrent, setBuses, setTrams, setTrolls } from 'state/features/public-transport';
import { MapRoutes } from 'components/Map/Routes/MapRoutes';
import { MapStopRoutes } from 'components/Map/Routes/MapStopRoutes';
import { MapStops } from 'components/Map/Stops/MapStops';
import { MapVehicles } from 'components/Map/Vehicles/MapVehicles';
import { MapRail } from 'components/Map/Rail/MapRail';
import { MapDepots } from 'components/Map/Depots/MapDepots';
import { State } from 'common/types/state';
import { useMapPreferences } from 'components/MapPreferencesProvider';
import { flyToBoundsVisible } from 'components/Map/mapViewport';

export function MapTransport() {
    const dispatch = useDispatch();
    const map = useMap();
    const { layers } = useMapPreferences();

    const currentRoute = useSelector((state: State) => state.publicTransport.currentRoute);
    const currentVehicle = useSelector((state: State) => state.publicTransport.currentVehicle);

    const updateTransport = async () => {
        const [tramsRes, trollsRes, busesRes] = await Promise.all([
            massTransApi.getVehicles(ClientUnit.Tram),
            massTransApi.getVehicles(ClientUnit.Troll),
            massTransApi.getVehicles(ClientUnit.Bus),
        ]);

        // null означает сбой запроса (см. массTransApi.getVehicles) - оставляем на карте
        // прежние машины этого типа вместо того, чтобы стереть их до следующего опроса через
        // 30с. [] - настоящий пустой ответ, его отрисовываем как есть.
        trollsRes !== null && dispatch(setTrolls(trollsRes));
        tramsRes !== null && dispatch(setTrams(tramsRes));
        busesRes !== null && dispatch(setBuses(busesRes));
    };

    useEffect(() => {
        updateTransport();

        const intervalId = setInterval(() => {
            updateTransport();
        }, 30000);

        return () => clearInterval(intervalId);
    }, []);

    useMapEvent('click', () => {
        // Нажатие ставит точку маршрута (MapJourneyLayer) - панель «Маршрут» не закрываем.
        if (getJourneyState().picking) return;
        dispatch(clearCurrent());
        sidebarService.close();
    });

    useEffect(() => {
        // Нужны оба значения разом (маршрут долетаемых границ берётся из currentRoute, а
        // направление - из currentVehicle) - было "&&", пропускавшее только состояние "оба
        // пусты", а не "только одно из двух". currentRoute вдобавок может быть null и при
        // выбранной машине (см. setCurrentVehicle в state/features/public-transport.ts, когда
        // getRoute() возвращает null на ошибке) - именно на этом состоянии деструктуризация
        // ниже падала.
        if (!currentVehicle || !currentRoute) {
            return;
        }

        const { routeDirection } = currentVehicle;
        const { races, shouldFlyTo } = currentRoute;

        if (!shouldFlyTo) {
            return;
        }

        const race = races.find((race) => race.raceType === routeDirection);

        // У живых машин subrouteId иногда не совпадает ни с одним направлением маршрута из
        // статического route_stops (данные с портала и наш снэпшот расходятся) - тогда просто
        // не долетаем до границ, а не падаем.
        if (!race) {
            return;
        }

        const bounds = race.stops.map((stop) => stop.coords);

        // Маршрут целиком - в видимой части, не под карточкой маршрута.
        flyToBoundsVisible(map, bounds);
    }, [currentVehicle, currentRoute]);

    return (
        <>
            {/* Render vehicles */}
            <Pane name="vehicles" style={{ zIndex: 550 }}>
                {/* Слои из настроек (TASK-196): выключенный слой просто не рисуется. */}
                {layers.troll && <MapVehicles type={ClientUnit.Troll} />}
                {layers.tram && <MapVehicles type={ClientUnit.Tram} />}
                {layers.bus && <MapVehicles type={ClientUnit.Bus} />}
            </Pane>

            {/* Депо - ниже линий маршрутов (overlayPane, z-index 400) и всех значков */}
            <Pane name="depots" style={{ zIndex: 350 }}>
                {layers.depots && <MapDepots />}
            </Pane>

            {/* Маршруты выбранной остановки - бледно, под линией выбранного рейса */}
            <MapStopRoutes />

            {/* Render selected route */}
            <MapRoutes />

            {/* Render stops */}
            <Pane name="stops" style={{ zIndex: 500 }}>
                {layers.stops && <MapStops />}
            </Pane>

            {/* Render railway stations, platforms and passenger hubs */}
            <Pane name="rail" style={{ zIndex: 460 }}>
                {layers.rail && <MapRail />}
            </Pane>
        </>
    );
}
