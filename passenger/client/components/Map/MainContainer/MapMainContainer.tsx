import React, { useEffect, useState } from 'react';
import { MapContainer, Pane, useMapEvents } from 'react-leaflet';
import classNames from 'classnames/bind';
import sidebarStyles from 'styles/leaflet-sidebar.module.css';

import { sidebarService } from 'services/sidebar/sidebar';

import { COORDS_KRASNODAR, BOUNDS_KRASNODAR } from 'common/constants/coords';
import { POSITION_CLASSES } from 'common/constants/positions';

import { MapLocation } from 'components/Map/Location/MapLocation';
import { MapTransport } from 'components/Map/Transport/MapTransport';
import { MapZoomControl } from 'components/Map/ZoomControl/MapZoomControl';
import { MapSearchBar } from 'components/Map/SearchBar/SearchBar';
import { Info } from 'components/Map/Info/Info';
import { MapNearby } from 'components/Map/Nearby/MapNearby';
import { MapSettings } from 'components/Map/Settings/MapSettings';
import { ThemeToggle } from 'components/UI/ThemeToggle/ThemeToggle';

import { MAP_LAST_VIEW_STORAGE_KEY, readMapPreferences } from 'components/MapPreferencesProvider';

import { MapDeepLink } from 'components/Map/DeepLink/MapDeepLink';
import { MapHotkeys } from 'components/Map/Hotkeys/MapHotkeys';
import { MapWeather } from 'components/Map/Weather/MapWeather';
import { MapTraffic } from 'components/Map/Weather/MapTraffic';
import { MapHotkeysControl } from 'components/Map/Hotkeys/MapHotkeysControl';
import { MapFavoritesPanel } from 'components/Map/Favorites/MapFavoritesPanel';
import { MapJourneyControl } from 'components/Map/Journey/MapJourneyControl';
import { MapJourneyLayer } from 'components/Map/Journey/MapJourneyLayer';

import { MapLabelCollisions } from 'components/Map/MapLabelCollisions';

import { MapVectorBasemap } from './MapVectorBasemap';
import styles from './MapMainContainer.module.css';
import 'leaflet/dist/leaflet.css';

const cn = classNames.bind(styles);

type LatLngTuple = [number, number];

/** Где карта была в прошлый раз - если запись битая или вне города, null. */
function readLastView(): { center: LatLngTuple; zoom: number } | null {
    try {
        const view = JSON.parse(localStorage.getItem(MAP_LAST_VIEW_STORAGE_KEY) || 'null');
        const [lat, lng] = view?.center ?? [];
        const [[south, west], [north, east]] = BOUNDS_KRASNODAR as [LatLngTuple, LatLngTuple];

        if (
            typeof lat === 'number' &&
            typeof lng === 'number' &&
            typeof view.zoom === 'number' &&
            lat >= Math.min(south, north) &&
            lat <= Math.max(south, north) &&
            lng >= Math.min(west, east) &&
            lng <= Math.max(west, east)
        ) {
            return { center: [lat, lng], zoom: view.zoom };
        }
    } catch (e) {}

    return null;
}

/** Запоминает центр и масштаб после каждого перемещения - для стартовой точки «где остановились». */
function RememberView() {
    const map = useMapEvents({
        moveend() {
            const { lat, lng } = map.getCenter();
            try {
                localStorage.setItem(
                    MAP_LAST_VIEW_STORAGE_KEY,
                    JSON.stringify({ center: [lat, lng], zoom: map.getZoom() }),
                );
            } catch (e) {}
        },
    });

    return null;
}

function MapMainContainer({ zoom = 16, showControls = true }) {
    const [sidebar, setSidebar] = useState<React.ReactElement>(null);
    // Стартовая точка (TASK-199). Карта грузится только на клиенте (dynamic, ssr: false),
    // поэтому настройки читаем прямо при первом рендере - MapContainer берёт center/zoom
    // один раз при создании.
    const [initialView] = useState(() => {
        const { startView } = readMapPreferences();
        const last = startView === 'last' ? readLastView() : null;

        return {
            startView,
            center: last?.center ?? (COORDS_KRASNODAR as LatLngTuple),
            zoom: last?.zoom ?? zoom,
        };
    });

    // Открытие приветствия по первому визиту переехало целиком в Info (см. её комментарий) -
    // раньше этот же localStorage-ключ читал и писал ещё и этот компонент, оба открывали
    // MapWelcomeMessage, и срабатывал только тот, чей эффект отработал первым.
    useEffect(() => {
        sidebarService.setSidebar = setSidebar;
    }, []);

    return (
        <MapContainer
            center={initialView.center}
            attributionControl={null}
            zoomControl={false}
            zoom={initialView.zoom}
            zoomDelta={0.6}
            minZoom={13}
            maxBounds={BOUNDS_KRASNODAR}
            scrollWheelZoom
            doubleClickZoom={false}
            className={cn(styles.Map)}
        >
            <MapVectorBasemap />
            <RememberView />

            {showControls && (
                <>
                    <Pane name="location" style={{ zIndex: 400 }} />
                    <MapLocation locateOnStart={initialView.startView === 'location'} />
                    <MapZoomControl position="bottomright" />
                    <MapJourneyControl />
                    <MapHotkeysControl />
                </>
            )}

            <MapTransport />
            <MapJourneyLayer />
            <MapLabelCollisions />
            {showControls && (
                <>
                    <MapDeepLink />
                    <MapHotkeys />
                    <div
                        className={cn(
                            POSITION_CLASSES.topleft,
                            sidebarStyles.leafletSidebar,
                            styles.MapSidebar,
                        )}
                    >
                        <MapSearchBar collapsed={Boolean(sidebar)} />

                        {sidebar}
                    </div>
                    <div
                        className={cn(
                            POSITION_CLASSES.topright,
                            sidebarStyles.leafletSidebar,
                            styles.MapAdditionalButtons,
                        )}
                    >
                        <MapTraffic />
                        <MapWeather />
                        <Info />
                        <MapNearby />
                        <MapSettings />
                        <ThemeToggle />
                    </div>
                    {/* Пока открыта карточка, панель избранного спрятана - иначе на телефоне
                        они перекрывали бы друг друга. */}
                    {!sidebar && (
                        <div className={cn(POSITION_CLASSES.bottomleft, styles.MapBottomLeft)}>
                            <MapFavoritesPanel />
                        </div>
                    )}
                </>
            )}
        </MapContainer>
    );
}

export default MapMainContainer;
