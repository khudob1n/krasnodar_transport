import React, { useMemo } from 'react';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';

import { sidebarService } from 'services/sidebar/sidebar';
import { StationIcon } from 'components/UI/StationIcon/StationIcon';

import { RailSidebar } from './RailSidebar';
import { RailStation } from './MapRail';
import styles from './Rail.module.css';
import stopStyles from '../Stops/Item/MapStopsItem.module.css';

// Какой ползунок настроек управляет размером значка: аэропорт свой, автовокзалы идут в
// «прочие объекты», ж/д станции и платформы - в «железнодорожные станции».
const SIZE_GROUP_BY_KIND = {
    railway_station: 'rail',
    rail_stop: 'rail',
    airport: 'airport',
    bus_terminal: 'other',
} as const;

export function RailStationItem({
    station,
    showLabel,
}: {
    station: RailStation;
    showLabel: boolean;
}) {
    const icon = useMemo(
        () =>
            new L.DivIcon({
                html: ReactDOMServer.renderToStaticMarkup(
                    <span
                        className={`${styles.RailMarkerPin} ${
                            styles[`RailMarkerPin_${SIZE_GROUP_BY_KIND[station.kind]}`]
                        }`}
                    >
                        <StationIcon kind={station.kind} alt="" />
                    </span>,
                ),
                iconSize: [22, 22],
                iconAnchor: [11, 11],
                className: styles.RailMarker,
            }),
        [station.kind],
    );

    return (
        <Marker
            position={[station.lat, station.lng]}
            icon={icon}
            alt={station.name}
            title={station.name}
            eventHandlers={{
                click() {
                    sidebarService.open({ component: <RailSidebar station={station} /> });
                },
            }}
        >
            {showLabel && (
                <Tooltip
                    permanent
                    interactive
                    bubblingMouseEvents={false}
                    direction="right"
                    offset={[13, 0]}
                    // Та же голая подпись с обводкой, что у остановок и метро, без плашки.
                    className={`${stopStyles.MapStopsItemLabel} ${
                        stopStyles[`MapLabel_${SIZE_GROUP_BY_KIND[station.kind]}`]
                    }`}
                >
                    {station.name}
                </Tooltip>
            )}
        </Marker>
    );
}
