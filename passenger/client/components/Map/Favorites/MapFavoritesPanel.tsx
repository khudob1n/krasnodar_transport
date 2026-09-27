import React, { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames/bind';
import { useSelector } from 'react-redux';
import { IconCheck, IconChevronDown, IconPencil, IconStarFilled, IconX } from '@tabler/icons-react';

import { StopInfoItem } from 'transport-common/types/masstrans';

import { State } from 'common/types/state';
import { massTransApi, RouteSearchItem } from 'api/masstrans/masstrans';
import { STOP_NAME_MAX_LENGTH, useFavorites } from 'components/FavoritesProvider';
import { useMapPreferences } from 'components/MapPreferencesProvider';
import { useOpenStop } from 'components/Map/Stops/useOpenStop';
import { withHotkey } from 'services/hotkeys';
import { useReveal } from 'hooks/useReveal';
import { useOpenRoute } from 'components/Map/Routes/useOpenRoute';
import { MapVehiclesRoute } from 'components/Map/Vehicles/Route/MapVehiclesRoute';
import { formatArrival } from 'components/Map/Stops/Sidebar/StopsList/Item/MapStopsSidebarStopsListItem.utils';
import { useDisablePropagation } from 'hooks/useDisablePropagation';
import { useSmoothCorners } from 'hooks/useSmoothCorners';

import styles from './MapFavoritesPanel.module.css';

const cn = classNames.bind(styles);

const ARRIVALS_PER_STOP = 3;
const REFRESH_MS = 60 * 1000;
const COLLAPSED_STORAGE_KEY = 'favorites-panel-collapsed';
const MOBILE_QUERY = '(max-width: 768px)';

/** Узкий экран: там избранное по умолчанию - маленькая кнопка, а не панель. */
function useIsMobile() {
    const [mobile, setMobile] = useState(false);

    useEffect(() => {
        const query = window.matchMedia(MOBILE_QUERY);
        const update = () => setMobile(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    return mobile;
}

type FavoriteStop = { stopId: string; title: string };

/** Строка остановки: название, ближайшие рейсы и карандаш для своего названия (TASK-212). */
function StopRow({
    stop,
    arrivals,
    formatTime,
}: {
    stop: FavoriteStop;
    arrivals?: StopInfoItem[];
    formatTime: (arriveTime: string) => string;
}) {
    const { stopNames, renameStop } = useFavorites();
    const openStop = useOpenStop();
    const customTitle = stopNames[stop.stopId];
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    if (editing) {
        const save = () => {
            renameStop(stop.stopId, value);
            setEditing(false);
        };

        return (
            <form
                className={cn(styles.MapFavoritesPanelRename)}
                onSubmit={(event) => {
                    event.preventDefault();
                    save();
                }}
            >
                <input
                    ref={inputRef}
                    value={value}
                    maxLength={STOP_NAME_MAX_LENGTH}
                    placeholder={stop.title}
                    aria-label={`Своё название для остановки «${stop.title}»`}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') setEditing(false);
                    }}
                    className={cn(styles.MapFavoritesPanelRenameInput)}
                />
                <button
                    type="submit"
                    className={cn(styles.MapFavoritesPanelIconButton)}
                    aria-label="Сохранить название"
                >
                    <IconCheck size={18} stroke={2} aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={cn(styles.MapFavoritesPanelIconButton)}
                    aria-label="Отменить"
                    onClick={() => setEditing(false)}
                >
                    <IconX size={18} stroke={2} aria-hidden="true" />
                </button>
            </form>
        );
    }

    return (
        <div className={cn(styles.MapFavoritesPanelStopRow)}>
            <button
                type="button"
                className={cn(styles.MapFavoritesPanelStop)}
                onClick={() => openStop(stop.stopId)}
            >
                <span className={cn(styles.MapFavoritesPanelName)}>
                    {customTitle || stop.title}
                    {customTitle && <small>{stop.title}</small>}
                </span>
                <span className={cn(styles.MapFavoritesPanelArrivals)}>
                    {!arrivals && (
                        <span className={cn(styles.MapFavoritesPanelMuted)}>Загружаем…</span>
                    )}
                    {arrivals && !arrivals.length && (
                        <span className={cn(styles.MapFavoritesPanelMuted)}>
                            Ближайших рейсов нет
                        </span>
                    )}
                    {arrivals?.slice(0, ARRIVALS_PER_STOP).map((item) => (
                        <span
                            key={`${item.type}-${item.route}-${item.arriveTime}`}
                            className={cn(styles.MapFavoritesPanelArrival)}
                        >
                            <MapVehiclesRoute type={item.type} num={item.route} size="xs" />
                            <span>{formatTime(item.arriveTime)}</span>
                        </span>
                    ))}
                </span>
            </button>
            <button
                type="button"
                className={cn(styles.MapFavoritesPanelIconButton)}
                onClick={() => {
                    setValue(customTitle ?? '');
                    setEditing(true);
                }}
                aria-label={`Переименовать остановку «${customTitle || stop.title}»`}
                title="Своё название"
            >
                <IconPencil size={16} stroke={2} aria-hidden="true" />
            </button>
        </div>
    );
}

/**
 * Избранное на карте - единственное место, где оно показано (кнопка-звезда сверху убрана, чтобы
 * не дублировать). Маршруты - номерами, остановки - с ближайшими рейсами (TASK-211) и своими
 * названиями (TASK-212). Панель сворачивается (состояние запоминается), пока открыта карточка -
 * скрыта.
 */
export function MapFavoritesPanel() {
    const { stopIds, routeIds } = useFavorites();
    const { arrivalFormat } = useMapPreferences();
    const allStops = useSelector((state: State) => state.publicTransport.stops);
    const openRoute = useOpenRoute();
    const [routes, setRoutes] = useState<RouteSearchItem[]>([]);
    const [arrivals, setArrivals] = useState<Record<string, StopInfoItem[]>>({});
    const [storedCollapsed, setStoredCollapsed] = useState(false);
    // На телефоне развёрнутая панель занимала до половины карты - там избранное сворачивается
    // в кнопку-звёздочку и открывается по нажатию. Это состояние не запоминаем: при следующем
    // открытии карты на телефоне снова кнопка.
    const isMobile = useIsMobile();
    const [mobileOpen, setMobileOpen] = useState(false);
    const collapsed = isMobile ? !mobileOpen : storedCollapsed;
    const [, setTick] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useDisablePropagation(ref);
    useSmoothCorners(ref);
    useDisablePropagation(buttonRef);
    useSmoothCorners(buttonRef);

    useEffect(() => {
        try {
            setStoredCollapsed(localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1');
        } catch (e) {}
    }, []);

    const toggleCollapsed = () => {
        if (isMobile) {
            setMobileOpen(!mobileOpen);
            return;
        }
        setStoredCollapsed(!storedCollapsed);
        try {
            localStorage.setItem(COLLAPSED_STORAGE_KEY, storedCollapsed ? '0' : '1');
        } catch (e) {}
    };

    useEffect(() => {
        if (routeIds.length && !routes.length) massTransApi.getRoutesList().then(setRoutes);
    }, [routeIds.length, routes.length]);

    const favoriteRoutes = useMemo(
        () =>
            routeIds
                .map((routeId) => routes.find((route) => route.routeId === routeId))
                .filter(Boolean),
        [routeIds, routes],
    );

    const stops = useMemo<FavoriteStop[]>(
        () =>
            stopIds
                .map((stopId) => allStops?.find((stop) => stop.attributes.stopId === stopId))
                .filter(Boolean)
                .map(({ attributes }) => ({ stopId: attributes.stopId, title: attributes.title })),
        [stopIds, allStops],
    );
    const stopKey = stops.map((stop) => stop.stopId).join(',');

    useEffect(() => {
        if (!stops.length || collapsed) return undefined;
        let active = true;

        const load = () =>
            Promise.all(
                stops.map(
                    async (stop) =>
                        [stop.stopId, await massTransApi.getStopInfo(stop.stopId)] as const,
                ),
            ).then((entries) => {
                if (active) setArrivals(Object.fromEntries(entries));
            });

        load();
        // Раз в минуту - новые данные и пересчёт «через N мин».
        const refresh = setInterval(() => {
            load();
            setTick((tick) => tick + 1);
        }, REFRESH_MS);

        return () => {
            active = false;
            clearInterval(refresh);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- перезапуск по набору остановок
    }, [stopKey, collapsed]);

    const formatTime = (arriveTime: string) => formatArrival(arriveTime, arrivalFormat);

    const isEmpty = !stops.length && !favoriteRoutes.length;
    // Развернули избранное - содержимое выезжает.
    const bodyRef = useRef<HTMLDivElement>(null);
    useReveal(bodyRef, !collapsed);

    if (isMobile && collapsed) {
        return (
            <button
                ref={buttonRef}
                type="button"
                className={cn(styles.MapFavoritesButton)}
                onClick={toggleCollapsed}
                aria-expanded={false}
                aria-label="Избранное"
                title={withHotkey('Избранное', 'favorites')}
                data-hotkey="favorites"
            >
                <IconStarFilled className={cn(styles.MapFavoritesButtonStar)} aria-hidden="true" />
            </button>
        );
    }

    return (
        <div ref={ref} className={cn(styles.MapFavoritesPanel)}>
            <button
                type="button"
                className={cn(styles.MapFavoritesPanelHeader)}
                onClick={toggleCollapsed}
                aria-expanded={!collapsed}
                title={withHotkey(
                    collapsed ? 'Развернуть избранное' : 'Свернуть избранное',
                    'favorites',
                )}
                data-hotkey="favorites"
            >
                <IconStarFilled className={cn(styles.MapFavoritesPanelStar)} aria-hidden="true" />
                <span>Избранное</span>
                <IconChevronDown
                    className={cn(styles.MapFavoritesPanelChevron, {
                        [styles.MapFavoritesPanelChevron_collapsed]: collapsed,
                    })}
                    aria-hidden="true"
                />
            </button>
            {!collapsed && (
                <div ref={bodyRef} className={cn(styles.MapFavoritesPanelBody)}>
                    {isEmpty && (
                        <p
                            className={cn(
                                styles.MapFavoritesPanelMuted,
                                styles.MapFavoritesPanelEmpty,
                            )}
                        >
                            Откройте остановку или маршрут и нажмите «В избранное» — они появятся
                            здесь.
                        </p>
                    )}
                    {favoriteRoutes.length > 0 && (
                        <div className={cn(styles.MapFavoritesPanelRoutes)}>
                            {favoriteRoutes.map((route) => (
                                <button
                                    type="button"
                                    key={route.routeId}
                                    className={cn(styles.MapFavoritesPanelRoute)}
                                    onClick={() => openRoute(route)}
                                    title={`${route.firstStation} – ${route.lastStation}`}
                                >
                                    <MapVehiclesRoute type={route.type} num={route.num} size="xs" />
                                </button>
                            ))}
                        </div>
                    )}
                    {stops.length > 0 && (
                        <ul className={cn(styles.MapFavoritesPanelList)}>
                            {stops.map((stop) => (
                                <li key={stop.stopId}>
                                    <StopRow
                                        stop={stop}
                                        arrivals={arrivals[stop.stopId]}
                                        formatTime={formatTime}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
