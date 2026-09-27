import React, { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { useSelector } from 'react-redux';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

import { StopInfoItem } from 'transport-common/types/masstrans';

import { State } from 'common/types/state';
import { massTransApi } from 'api/masstrans/masstrans';
import { useMapPreferences } from 'components/MapPreferencesProvider';
import { useOpenStop } from 'components/Map/Stops/useOpenStop';
import { MapVehiclesRoute } from 'components/Map/Vehicles/Route/MapVehiclesRoute';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';
import { Typography } from 'components/UI/Typography/Typography';
import { Divider } from 'components/UI/Divider/Divider';
import { formatArrival } from 'components/Map/Stops/Sidebar/StopsList/Item/MapStopsSidebarStopsListItem.utils';
import { useStopDirections } from 'hooks/useStopDirections';

import styles from './MapNearbySidebar.module.css';

const cn = classNames.bind(styles);

const NEARBY_COUNT = 5;
const ARRIVALS_PER_STOP = 4;

type Origin = { latlng: L.LatLng; source: 'user' | 'map' };

const formatDistance = (meters: number) =>
    meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1).replace('.', ',')} км`;

/**
 * Ближайшие остановки с прибытиями одним списком (TASK-210). Точка отсчёта - местоположение
 * пользователя; если доступ не дали или его нет - центр карты, и об этом написано.
 */
export function MapNearbySidebar() {
    const map = useMap();
    const allStops = useSelector((state: State) => state.publicTransport.stops);
    const { arrivalFormat } = useMapPreferences();
    const openStop = useOpenStop();
    const directions = useStopDirections();
    const [origin, setOrigin] = useState<Origin | null>(null);
    const [arrivals, setArrivals] = useState<Record<string, StopInfoItem[]>>({});

    useEffect(() => {
        const fallback = () => setOrigin({ latlng: map.getCenter(), source: 'map' });

        if (!navigator.geolocation) {
            fallback();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            ({ coords }) =>
                setOrigin({ latlng: L.latLng(coords.latitude, coords.longitude), source: 'user' }),
            fallback,
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
        );
    }, [map]);

    const nearest = useMemo(() => {
        if (!origin || !allStops?.length) return [];

        return allStops
            .map((stop) => ({
                stop: stop.attributes,
                distance: origin.latlng.distanceTo(stop.attributes.coords),
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, NEARBY_COUNT);
    }, [origin, allStops]);

    const nearestKey = nearest.map(({ stop }) => stop.stopId).join(',');

    useEffect(() => {
        if (!nearest.length) return undefined;
        let active = true;

        Promise.all(
            nearest.map(async ({ stop }) => [stop.stopId, await massTransApi.getStopInfo(stop.stopId)] as const),
        ).then((entries) => {
            if (active) setArrivals(Object.fromEntries(entries));
        });

        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- перезапуск по набору остановок
    }, [nearestKey]);

    const formatTime = (arriveTime: string) => formatArrival(arriveTime, arrivalFormat);

    return (
        <div className={cn(styles.MapNearby)}>
            <div className={cn(styles.MapNearbyHeader)}>
                <Typography variant="h4">Рядом со мной</Typography>
                {origin?.source === 'map' && (
                    <p className={cn(styles.MapNearbyNote)}>
                        Местоположение недоступно — показываем остановки у центра карты.
                    </p>
                )}
            </div>
            <Divider />
            {!origin && <p className={cn(styles.MapNearbyNote, styles.MapNearbyPadded)}>Определяем, где вы…</p>}
            <ul className={cn(styles.MapNearbyList)}>
                {nearest.map(({ stop, distance }) => {
                    const items = arrivals[stop.stopId];
                    const direction = directions?.get(stop.stopId);

                    return (
                        <li key={stop.stopId}>
                            <button type="button" className={cn(styles.MapNearbyStop)} onClick={() => openStop(stop.stopId)}>
                                <TransportIcon type={stop.type} variant="stop" alt="" className={cn(styles.MapNearbyIcon)} />
                                <span className={cn(styles.MapNearbyBody)}>
                                    <span className={cn(styles.MapNearbyTitle)}>
                                        <span>{stop.title}</span>
                                        <span className={cn(styles.MapNearbyDistance)}>{formatDistance(distance)}</span>
                                    </span>
                                    {direction && (
                                        <span className={cn(styles.MapNearbyNote)}>
                                            {'terminal' in direction ? 'Конечная' : `→ ${direction.next}`}
                                        </span>
                                    )}
                                    <span className={cn(styles.MapNearbyArrivals)}>
                                        {!items && <span className={cn(styles.MapNearbyNote)}>Загружаем…</span>}
                                        {items && !items.length && (
                                            <span className={cn(styles.MapNearbyNote)}>Ближайших рейсов нет</span>
                                        )}
                                        {items?.slice(0, ARRIVALS_PER_STOP).map((item) => (
                                            <span key={`${item.type}-${item.route}-${item.arriveTime}`} className={cn(styles.MapNearbyArrival)}>
                                                <MapVehiclesRoute type={item.type} num={item.route} size="xs" />
                                                <span>{formatTime(item.arriveTime)}</span>
                                            </span>
                                        ))}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
