import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { Unit, ClientUnit } from 'transport-common/types/masstrans';

import { MapVehiclesItem } from './Item/MapVehiclesItem';
import { StaleHatchPattern } from './Marker/MapVehicleMarker';
import { VISISBILITY_MINIMAL_ZOOM } from './MapVehicles.constants';
import { useSelector } from 'react-redux';
import { State } from 'common/types/state';
import { useMapPreferences } from 'components/MapPreferencesProvider';
import { isSampledIn, vehicleSampleRateForZoom } from '../mapDensity';
import { useJourney } from 'services/journey/journeyStore';
import { VehicleUnit } from 'api/masstrans/masstrans';
import { isStale } from './staleness';

export type MapVehiclesProps = {
    type: ClientUnit;
};

export function MapVehicles({ type }: MapVehiclesProps) {
    const [hidden, setHidden] = useState(false);
    const [bounds, setBounds] = useState<L.LatLngBounds>(null);
    const [sampleRate, setSampleRate] = useState(1);
    const vehicles = useSelector((state: State) => state.publicTransport.units[type]);
    const currentVehicle = useSelector((state: State) => state.publicTransport.currentVehicle);
    const currentStopVehicles = useSelector((state: State) => state.publicTransport.stopVehicles);
    const currentStop = useSelector((state: State) => state.publicTransport.currentStop);
    const { lowFloorOnly, showStale } = useMapPreferences();
    const journey = useJourney();

    // Пока на карте показан маршрут между остановками, остальные машины только мешают -
    // оставляем те, что идут по его маршрутам в нужном направлении (с параллельными).
    const journeyDirections = useMemo(() => {
        const planned =
            journey.panelOpen && journey.status === 'done'
                ? journey.journeys[journey.selected]
                : null;
        if (!planned) return null;
        const keys = new Set<string>();
        planned.legs.forEach((leg) => {
            if (leg.kind !== 'ride') return;
            leg.alternatives.forEach(({ pattern }) =>
                keys.add(`${pattern.routeId}:${pattern.subrouteId}`),
            );
        });
        return keys;
    }, [journey]);

    const map = useMapEvents({
        zoomend: () => {
            const zoom = map.getZoom();

            if (zoom < VISISBILITY_MINIMAL_ZOOM) {
                setHidden(true);
            } else {
                setHidden(false);
            }

            setSampleRate(vehicleSampleRateForZoom(zoom));
            setBounds(map.getBounds());
        },
        moveend: () => {
            setBounds(map.getBounds());
        },
    });

    useEffect(() => {
        setBounds(map.getBounds());
        setSampleRate(vehicleSampleRateForZoom(map.getZoom()));
    }, []);

    const filterVehicles = useCallback(
        (vehicle: Unit) => {
            if (!bounds?.contains(vehicle.coords)) {
                return false;
            }

            // «Только низкопольный транспорт» (TASK-197) - поверх всех остальных фильтров.
            if (lowFloorOnly && !vehicle.accessibility) {
                return false;
            }

            // Машины с давними координатами (заштрихованные) можно скрыть в настройках.
            if (!showStale && isStale((vehicle as VehicleUnit).navTime)) {
                return false;
            }

            if (journeyDirections) {
                // Стоящие в депо с давними координатами на маршрут не выйдут - не показываем.
                return (
                    journeyDirections.has(`${vehicle.routeId}:${vehicle.routeDirection}`) &&
                    !isStale((vehicle as VehicleUnit).navTime)
                );
            }

            const isStopActive = currentStop || Boolean(currentStopVehicles.length);

            if (isStopActive && !currentVehicle) {
                return currentStopVehicles.some(
                    (stopVehicle) =>
                        stopVehicle.route === vehicle.num &&
                        stopVehicle.type === vehicle.type &&
                        stopVehicle.routeDirection === vehicle.routeDirection,
                );
            }

            if (!currentVehicle) {
                // Только в этом (дефолтном, ничего не выбрано) случае прореживаем - когда
                // выбран маршрут или остановка, машин и так немного, прятать их не нужно.
                return isSampledIn(vehicle.id, sampleRate);
            }

            const isSameRoute =
                currentVehicle.num === vehicle.num && currentVehicle.type === vehicle.type;

            if (!currentVehicle.shouldFilterByRouteDirection) {
                return isSameRoute;
            }

            return isSameRoute && currentVehicle.routeDirection === vehicle.routeDirection;
        },
        [
            currentStopVehicles,
            currentVehicle,
            currentStop,
            bounds,
            sampleRate,
            lowFloorOnly,
            showStale,
            journeyDirections,
        ],
    );

    return !hidden && bounds && vehicles ? (
        <>
            <StaleHatchPattern type={type} />
            {vehicles.filter(filterVehicles).map((vehicle) => (
                <MapVehiclesItem
                    {...vehicle}
                    type={type}
                    key={`${type}-${vehicle.id}-${vehicle.num}`}
                />
            ))}
        </>
    ) : null;
}
