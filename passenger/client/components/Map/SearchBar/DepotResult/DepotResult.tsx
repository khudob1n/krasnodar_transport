import React from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

import { Depot } from 'components/Map/Depots/MapDepots';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';

import { flyToBoundsVisible } from 'components/Map/mapViewport';
import styles from './DepotResult.module.css';

/**
 * Депо в поиске: значок вида транспорта его цветом и название. Вид депо отдельной строкой не
 * пишем - он уже есть в каждом названии («Южное трамвайное депо»). По клику камера
 * облетает территорию целиком - полигон депо на карте и так подсвечен цветом вида транспорта,
 * а на крупном масштабе у него появляется подпись.
 */
export function MapSearchBarDepotResult({ depot }: { depot: Depot }) {
    const map = useMap();

    return (
        <button
            type="button"
            className={styles.DepotResult}
            onClick={() => {
                flyToBoundsVisible(map, L.latLngBounds(depot.polygons.flat()), { maxZoom: 17 });
            }}
        >
            <TransportIcon type={depot.type} alt="" />
            <span>{depot.name}</span>
        </button>
    );
}
