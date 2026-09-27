import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMapEvents } from 'react-leaflet';
import { useDispatch, useSelector } from 'react-redux';

import { State } from 'common/types/state';
import { setStops } from 'state/features/public-transport';
import { massTransApi } from 'api/masstrans/masstrans';
import { useMapPreferences } from 'components/MapPreferencesProvider';
import { StopType } from 'transport-common/types/masstrans';

import { MapStopsItem } from './Item/MapStopsItem';
import {
    LABELS_MINIMAL_ZOOM,
    STOP_LABEL_COLLISION_PADDING_PX,
    STOP_LABEL_GROUP_RADIUS_METERS,
    VISISBILITY_MINIMAL_ZOOM,
} from './MapStops.constants';
import { selectStopLabelIds } from './MapStops.utils';
import { isSampledIn, stopSampleRateForZoom } from '../mapDensity';

// Остановки выключенных в настройках видов транспорта тоже прячем: без машин они только
// мешают. Совмещённая остановка видна, пока включён хотя бы один из её видов.
function isStopTypeVisible(type: StopType, layers: { bus: boolean; troll: boolean; tram: boolean }) {
    switch (type) {
        case StopType.Bus:
            return layers.bus;
        case StopType.Troll:
            return layers.troll;
        case StopType.Tram:
            return layers.tram;
        case StopType.TrollBus:
            return layers.bus || layers.troll;
        default:
            return true;
    }
}

export function MapStops() {
    const dispatch = useDispatch();
    const stops = useSelector((state: State) => state.publicTransport.stops);
    const currentStop = useSelector((state: State) => state.publicTransport.currentStop);
    const currentVehicleStops = useSelector((state: State) => state.publicTransport.vehicleStops);
    const [hidden, setHidden] = useState(false);
    const [bounds, setBounds] = useState<L.LatLngBounds>(null);
    const [sampleRate, setSampleRate] = useState(1);
    const [withLabels, setWithLabels] = useState(false);
    const { layers } = useMapPreferences();

    const map = useMapEvents({
        zoomend: () => {
            const zoom = map.getZoom();

            if (zoom < VISISBILITY_MINIMAL_ZOOM) {
                setHidden(true);
            } else {
                setHidden(false);
            }

            setSampleRate(stopSampleRateForZoom(zoom));
            setWithLabels(zoom >= LABELS_MINIMAL_ZOOM);
            setBounds(map.getBounds());
        },
        moveend: () => {
            setBounds(map.getBounds());
        },
    });

    const updateStops = useCallback(async () => {
        const stopsFromApi = (await massTransApi.getStops()) || [];

        dispatch(setStops(stopsFromApi));
    }, []);

    useEffect(() => {
        updateStops();
        setBounds(map.getBounds());
        setSampleRate(stopSampleRateForZoom(map.getZoom()));
        setWithLabels(map.getZoom() >= LABELS_MINIMAL_ZOOM);
    }, []);

    const visibleStops = useMemo(
        () =>
            !bounds || !stops
                ? []
                : stops.filter(
                      (stop) =>
                          bounds.contains(stop.attributes.coords) &&
                          isStopTypeVisible(stop.attributes.type, layers) &&
                          // Выбранную остановку прореживание не трогает - иначе после выбора
                          // в поиске её значок мог просто не появиться на карте.
                          (isSampledIn(stop.id, sampleRate) ||
                              stop.attributes.stopId === currentStop),
                  ),
        [stops, bounds, sampleRate, currentStop, layers],
    );

    const labelStopIds = useMemo(() => {
        if (!withLabels) return new Set<string>();

        const hasActiveStop = currentStop !== null;
        const isVehicleActive = currentVehicleStops.length > 0;
        const labelCandidates = visibleStops
            .filter((stop) => {
                if (hasActiveStop) return stop.attributes.stopId === currentStop;
                if (isVehicleActive) return currentVehicleStops.includes(stop.attributes.stopId);
                return true;
            })
            .map((stop) => ({
                id: stop.attributes.stopId,
                name: stop.attributes.title,
                coords: stop.attributes.coords,
                isActive: stop.attributes.stopId === currentStop,
            }));

        return selectStopLabelIds(
            labelCandidates,
            map,
            STOP_LABEL_GROUP_RADIUS_METERS,
            STOP_LABEL_COLLISION_PADDING_PX,
        );
    }, [visibleStops, withLabels, currentStop, currentVehicleStops, map]);

    return !hidden && bounds && stops ? (
        <>
            {visibleStops.map((stop) => (
                <MapStopsItem
                    key={stop.id}
                    coords={stop.attributes.coords}
                    type={stop.attributes.type}
                    id={stop.attributes.stopId}
                    name={stop.attributes.title}
                    withLabel={labelStopIds.has(stop.attributes.stopId)}
                />
            ))}
        </>
    ) : null;
}
