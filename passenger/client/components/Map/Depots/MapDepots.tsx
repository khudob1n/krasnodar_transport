import React, { useEffect, useState } from 'react';
import { Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet';

import { ClientUnit } from 'transport-common/types/masstrans';

import { loadCollection } from 'api/ekb/collections';
import { LABELS_MINIMAL_ZOOM } from 'components/Map/mapDensity';

import stopStyles from 'components/Map/Stops/Item/MapStopsItem.module.css';
import styles from './MapDepots.module.css';

// data/ground_transport/depots.json - территории депо и автопарков из OpenStreetMap.
export interface Depot {
    id: string;
    name: string;
    type: ClientUnit;
    operator: string;
    polygons: [number, number][][];
}

/**
 * Депо на карте - полигоны территорий в цвете вида транспорта (трамвай - оранжевый,
 * троллейбус - голубой, автобус - зелёный). Цвет задаётся классом, а не pathOptions.color:
 * Leaflet пишет цвет в SVG-атрибут stroke, а там CSS-переменные темы не работают.
 * Полигоны не перехватывают клики - под ними остаются остановки и сама карта.
 */
export function MapDepots() {
    const map = useMap();
    const [depots, setDepots] = useState<Depot[]>([]);
    const [withLabels, setWithLabels] = useState(false);

    useMapEvents({ zoomend: () => setWithLabels(map.getZoom() >= LABELS_MINIMAL_ZOOM) });

    useEffect(() => {
        loadCollection<Depot>('ground_transport/depots')
            .then(setDepots)
            .catch((error) => console.warn('Не удалось загрузить депо', error));
        setWithLabels(map.getZoom() >= LABELS_MINIMAL_ZOOM);
    }, []);

    return (
        <>
            {depots.map((depot) => (
                <Polygon
                    key={depot.id}
                    positions={depot.polygons}
                    interactive={false}
                    pathOptions={{ className: `${styles.MapDepot} ${styles[`MapDepot_${depot.type}`]}` }}
                >
                    {withLabels && (
                        <Tooltip
                            permanent
                            direction="center"
                            className={`${stopStyles.MapStopsItemLabel} ${styles.MapDepotLabel}`}
                        >
                            {/* Вид депо уже есть в каждом названии («Южное трамвайное
                                депо», «Автобусный парк № 3») - отдельной строкой не дублируем. */}
                            {depot.name}
                        </Tooltip>
                    )}
                </Polygon>
            ))}
        </>
    );
}
