import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { useReveal } from 'hooks/useReveal';
import { useDispatch, useSelector } from 'react-redux';
import { useMap } from 'react-leaflet';
import { flyToVisible } from 'components/Map/mapViewport';
import { DevIds } from 'components/UI/DevIds/DevIds';

import { Race } from 'transport-common/types/masstrans';

import { store } from 'state';
import { State } from 'common/types/state';
import { massTransApi, RouteSearchItem } from 'api/masstrans/masstrans';
import { setCurrentStop, setCurrentVehicle } from 'state/features/public-transport';
import { sidebarService } from 'services/sidebar/sidebar';
import { VEHICLE_TYPE_COLORS, VEHICLE_TYPE_TRANSLUCENT_COLORS } from 'common/constants/colors';
import { getNoun } from 'utils/plural';
import t from 'utils/typograph';

import { Divider } from 'components/UI/Divider/Divider';
import { PageText } from 'components/UI/Typography/PageText/PageText';
import { Typography } from 'components/UI/Typography/Typography';
import { MapVehiclesRoute } from 'components/Map/Vehicles/Route/MapVehiclesRoute';
import { MapStopsSidebar } from 'components/Map/Stops/Sidebar/MapStopsSidebar';
import { FavoriteButton } from 'components/UI/FavoriteButton/FavoriteButton';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';
import { useFavorites } from 'components/FavoritesProvider';

import Arrow from 'public/icons/chevron-down.svg';
import Swap from 'public/icons/swap.svg';

import styles from './MapRouteSidebar.module.css';

const cn = classNames.bind(styles);

export function MapRouteSidebar({ routeId, num, type, directions }: RouteSearchItem) {
    const dispatch = useDispatch<typeof store.dispatch>();
    const map = useMap();
    const allStops = useSelector((state: State) => state.publicTransport.stops);
    const { isRouteFavorite, toggleRoute } = useFavorites();

    const [races, setRaces] = useState<Race[]>([]);
    const [selectedDirection, setSelectedDirection] = useState(directions[0]);
    const [directionsOpened, setDirectionsOpened] = useState(false);
    const [stopsOpened, setStopsOpened] = useState(false);
    // Раскрытие: другие направления и скрытые остановки появляются лесенкой.
    const directionsRef = useRef<HTMLUListElement>(null);
    const stopsRef = useRef<HTMLDivElement>(null);
    useReveal(directionsRef, directionsOpened, { items: 'li' });
    useReveal(stopsRef, stopsOpened, { items: 'li', container: false });

    useEffect(() => {
        let active = true;
        massTransApi.getRoute(routeId).then((route) => {
            if (active) setRaces(route?.races || []);
        });
        return () => {
            active = false;
        };
    }, [routeId]);

    const stops = useMemo(
        () => races.find((race) => race.raceType === selectedDirection.routeDirection)?.stops || [],
        [races, selectedDirection],
    );

    const startStop = stops[0];
    const endStop = stops[stops.length - 1];
    const middleStops = useMemo(() => stops.slice(1, -1), [stops]);

    const otherDirections = useMemo(
        () => directions.filter((d) => d.routeDirection !== selectedDirection.routeDirection),
        [directions, selectedDirection],
    );

    const selectDirection = useCallback(
        (direction: RouteSearchItem['directions'][number]) => {
            setSelectedDirection(direction);
            setStopsOpened(false);

            dispatch(
                setCurrentVehicle({
                    num,
                    routeDirection: direction.routeDirection,
                    type,
                    routeId,
                    shouldFlyTo: true,
                    shouldFilterByRouteDirection: true,
                }),
            );
        },
        [dispatch, num, routeId, type],
    );

    const setSelectedStop = useCallback(
        (stopId: string) => {
            const stop = allStops.find((stopFullData) => stopFullData.attributes.stopId === stopId);

            if (!stop) {
                return;
            }

            const { attributes: stopData } = stop;

            dispatch(
                setCurrentStop({
                    currentStop: stopId,
                    shouldClear: false,
                }),
            );

            flyToVisible(map, stopData.coords, 15);

            sidebarService.open({
                component: (
                    <MapStopsSidebar type={stopData.type} name={stopData.title} stopId={stopId} />
                ),
                onClose: () => dispatch(setCurrentStop(null)),
            });
        },
        [dispatch, allStops, map],
    );

    return (
        <div
            className={cn(styles.MapRouteSidebar)}
            style={
                {
                    '--vehicle-color': VEHICLE_TYPE_COLORS[type],
                } as React.CSSProperties
            }
        >
            <div className={cn(styles.MapRouteSidebarHeader)}>
                <TransportIcon
                    type={type}
                    width={32}
                    height={32}
                    style={{ fill: 'var(--vehicle-color)' }}
                    alt={type}
                />
                <MapVehiclesRoute type={type} num={num} size="l" />
                <FavoriteButton
                    subject="маршрут"
                    isActive={isRouteFavorite(routeId)}
                    onToggle={() => toggleRoute(routeId)}
                />
            </div>
            <div className={cn(styles.MapRouteSidebarDevIds)}>
                <DevIds
                    items={[
                        ['ID маршрута', routeId],
                        ['ID направления', selectedDirection.routeDirection],
                    ]}
                />
            </div>
            <div className={cn(styles.MapRouteSidebarDirectionInfo)}>
                <ul className={cn(styles.MapRouteSidebarDirection)}>
                    <li className={cn(styles.MapRouteSidebarHeaderStation)}>
                        <div className={cn(styles.MapRouteSidebarHeaderBullet)} />
                        <Typography variant="h4">{selectedDirection.firstStation}</Typography>
                    </li>
                    <li className={cn(styles.MapRouteSidebarHeaderStation)}>
                        <div
                            className={cn(
                                styles.MapRouteSidebarHeaderBullet,
                                styles.MapRouteSidebarHeaderBullet_fill,
                            )}
                        />
                        <Typography variant="h4">{selectedDirection.lastStation}</Typography>
                    </li>
                </ul>
                {/* Обратное направление - обычная пара "туда-обратно", есть почти у каждого
                    маршрута - переключаем сразу иконкой, без списка на один пункт. */}
                {otherDirections.length === 1 && (
                    <button
                        type="button"
                        className={cn(styles.MapRouteSidebarSwapButton)}
                        aria-label="Обратное направление"
                        onClick={() => selectDirection(otherDirections[0])}
                    >
                        <Swap />
                    </button>
                )}
            </div>
            {otherDirections.length > 1 && (
                <div className={cn(styles.MapRouteSidebarDirectionsWrapper)}>
                    <div
                        className={cn(styles.MapRouteSidebarDirectionsHeader)}
                        onClick={() => setDirectionsOpened(!directionsOpened)}
                    >
                        <Typography
                            className={cn(styles.MapRouteSidebarDirectionsTitle)}
                            variant="h3"
                        >
                            {`Ещё ${otherDirections.length} ${getNoun(
                                otherDirections.length,
                                'подмаршрут',
                                'подмаршрута',
                                'подмаршрутов',
                            )}`}
                        </Typography>
                        <Arrow
                            className={cn(styles.MapRouteSidebarDirectionsArrow, {
                                [styles.MapRouteSidebarDirectionsArrow_opened]: directionsOpened,
                            })}
                        />
                    </div>
                    {directionsOpened && (
                        <ul
                            ref={directionsRef}
                            className={cn(styles.MapRouteSidebarDirectionsList)}
                        >
                            {otherDirections.map((direction) => (
                                <li
                                    key={direction.routeDirection}
                                    className={cn(styles.MapRouteSidebarDirectionsItem)}
                                    onClick={() => selectDirection(direction)}
                                >
                                    <PageText>
                                        {direction.firstStation} – {direction.lastStation}
                                    </PageText>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {stops.length > 0 && (
                <div className={cn(styles.MapRouteSidebarStopsWrapper)}>
                    <Divider />
                    <ul
                        className={cn(
                            styles.MapRouteSidebarStops,
                            styles[`MapRouteSidebarStops_${type}`],
                        )}
                    >
                        {startStop && (
                            <li
                                className={cn(styles.MapRouteSidebarStop)}
                                onClick={() => setSelectedStop(startStop.stopId)}
                            >
                                <div
                                    className={cn(
                                        styles.MapRouteSidebarBullet,
                                        styles.MapRouteSidebarBullet_big,
                                    )}
                                    style={{ borderColor: VEHICLE_TYPE_COLORS[type] }}
                                />
                                <PageText
                                    className={cn(
                                        styles.MapRouteSidebarStopName,
                                        styles.MapRouteSidebarStartStation,
                                    )}
                                >
                                    {t(startStop.title)}
                                </PageText>
                            </li>
                        )}
                        {middleStops.length > 0 && (
                            <div
                                ref={stopsRef}
                                className={cn(styles.MapRouteSidebarHiddenStationWrapper)}
                                onClick={() => setStopsOpened(!stopsOpened)}
                            >
                                <div className={cn(styles.MapRouteSidebarHiddenCountTextWrapper)}>
                                    <PageText>
                                        {`${middleStops.length} ${getNoun(
                                            middleStops.length,
                                            'остановка',
                                            'остановки',
                                            'остановок',
                                        )}`}
                                    </PageText>
                                    <Arrow
                                        className={cn(styles.MapRouteSidebarHiddenArrow, {
                                            [styles.MapRouteSidebarHiddenArrow_opened]: stopsOpened,
                                        })}
                                    />
                                </div>
                                {stopsOpened &&
                                    middleStops.map((stop) => (
                                        <li
                                            key={stop.stopId}
                                            className={cn(styles.MapRouteSidebarStop)}
                                            onClick={() => setSelectedStop(stop.stopId)}
                                        >
                                            <div
                                                className={cn(styles.MapRouteSidebarBullet)}
                                                style={{
                                                    borderColor:
                                                        VEHICLE_TYPE_TRANSLUCENT_COLORS[type],
                                                }}
                                            />
                                            <PageText
                                                className={cn(styles.MapRouteSidebarStopName)}
                                            >
                                                {t(stop.title)}
                                            </PageText>
                                        </li>
                                    ))}
                            </div>
                        )}
                        {endStop && endStop !== startStop && (
                            <li
                                className={cn(styles.MapRouteSidebarStop)}
                                onClick={() => setSelectedStop(endStop.stopId)}
                            >
                                <div
                                    className={cn(
                                        styles.MapRouteSidebarBullet,
                                        styles.MapRouteSidebarBullet_big,
                                    )}
                                    style={{ borderColor: VEHICLE_TYPE_COLORS[type] }}
                                />
                                <PageText className={cn(styles.MapRouteSidebarStopName)}>
                                    {t(endStop.title)}
                                </PageText>
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
