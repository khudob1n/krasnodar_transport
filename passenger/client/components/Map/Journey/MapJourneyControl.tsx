import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

import { MapJourney } from './MapJourney';

import styles from './MapJourneyControl.module.css';

/**
 * Кнопка «Маршрут» - в правой нижней колонке, над масштабом. В верхнем ряду пятая кнопка
 * на телефоне налезла бы на поиск. Колонка - это контролы Leaflet, поэтому кнопка тоже
 * контрол, а React рисует в него порталом. Нижние контролы Leaflet вставляет над уже
 * добавленными - компонент должен стоять после MapZoomControl.
 */
export function MapJourneyControl() {
    const map = useMap();
    const [container, setContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const control = new L.Control({ position: 'bottomright' });
        control.onAdd = () => {
            const element = L.DomUtil.create('div', `leaflet-control ${styles.MapJourneyControl}`);
            L.DomEvent.disableClickPropagation(element);
            setContainer(element);
            return element;
        };
        control.addTo(map);

        return () => {
            control.remove();
            setContainer(null);
        };
    }, [map]);

    return container ? createPortal(<MapJourney />, container) : null;
}
