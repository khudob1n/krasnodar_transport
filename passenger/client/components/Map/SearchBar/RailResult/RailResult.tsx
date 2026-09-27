import React from 'react';
import { useMap } from 'react-leaflet';

import { RailSidebar } from 'components/Map/Rail/RailSidebar';
import { RailStation } from 'components/Map/Rail/MapRail';
import { sidebarService } from 'services/sidebar/sidebar';
import { StationIcon } from 'components/UI/StationIcon/StationIcon';
import { LABELS_MINIMAL_ZOOM } from 'components/Map/mapDensity';
import { flyToVisible } from 'components/Map/mapViewport';

import styles from './RailResult.module.css';

export function MapSearchBarRailResult({ station }: { station: RailStation }) {
    const map = useMap();
    return (
        <button
            type="button"
            className={styles.RailResult}
            onClick={() => {
                // С подписью: подписи станций видны с LABELS_MINIMAL_ZOOM.
                flyToVisible(
                    map,
                    [station.lat, station.lng],
                    Math.max(map.getZoom(), LABELS_MINIMAL_ZOOM),
                );
                sidebarService.open({ component: <RailSidebar station={station} /> });
            }}
        >
            <StationIcon kind={station.kind} alt="" />
            <span>{station.name}</span>
        </button>
    );
}
