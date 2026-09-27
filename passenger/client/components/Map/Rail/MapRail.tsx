import React, { useEffect, useState } from 'react';
import { useMapEvents } from 'react-leaflet';

import { loadCollection } from 'api/ekb/collections';
import { LABELS_MINIMAL_ZOOM } from 'components/Map/mapDensity';

import { RailStationItem } from './RailStationItem';

export type RailStationKind = 'railway_station' | 'rail_stop' | 'bus_terminal' | 'airport';

export interface RailStation {
    id: string;
    name: string;
    kind: RailStationKind;
    description: string;
    lat: number;
    lng: number;
    esr_code?: string;
}

export function MapRail() {
    const [stations, setStations] = useState<RailStation[]>([]);
    const [zoom, setZoom] = useState(0);
    const map = useMapEvents({
        zoomend: () => setZoom(map.getZoom()),
    });

    useEffect(() => {
        loadCollection<RailStation>('rail/stations')
            .then(setStations)
            .catch((error) => console.warn('Не удалось загрузить железнодорожные станции', error));
        setZoom(map.getZoom());
    }, []);

    return (
        <>
            {stations.map((station) => (
                <RailStationItem
                    station={station}
                    showLabel={zoom >= LABELS_MINIMAL_ZOOM}
                    key={station.id}
                />
            ))}
        </>
    );
}
