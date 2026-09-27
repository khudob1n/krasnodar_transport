import React, { useMemo } from 'react';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { MapContainer, Marker } from 'react-leaflet';

import { ClientUnit } from 'transport-common/types/masstrans';

import { useMapPreferences } from 'components/MapPreferencesProvider';
import { MapVectorBasemap } from 'components/Map/MainContainer/MapVectorBasemap';
import { MapStops } from 'components/Map/Stops/MapStops';
import { MapRail } from 'components/Map/Rail/MapRail';
import { MapVehicleMarker } from 'components/Map/Vehicles/Marker/MapVehicleMarker';
import { EAST_COURSE_RANGE } from 'components/Map/Vehicles/Item/MapVehiclesItem.constants';

import vehicleStyles from 'components/Map/Vehicles/Item/MapVehiclesItem.module.css';
import styles from './MapSettingsPreview.module.css';

// Место предпросмотра - Привокзальная площадь: в одном кадре вокзал Краснодар-1, автовокзал,
// конечные трамваев и троллейбусов, то есть значки почти всех видов, которые настраиваются
// ползунками (аэропорт далеко, в кадр с ними не помещается). Карта фиксированная: одно
// место, один масштаб.
const PREVIEW_CENTER: [number, number] = [45.0193, 38.9874];
const PREVIEW_ZOOM = 16;

// Моковые машины: стоят на месте и не зависят от живых данных, чтобы в предпросмотре всегда
// были все виды транспорта и значки не уезжали, пока двигаешь ползунок. Координаты и курс -
// с линий настоящих маршрутов (трамвай 15 к вокзалу, автобус 2Е к кольцу на площади,
// троллейбус 7 от него), курс выбран так, чтобы бейджи с номером уходили внутрь кадра.
const PREVIEW_VEHICLES: {
    id: string;
    type: ClientUnit;
    num: string;
    coords: [number, number];
    course: number;
    accessibility?: boolean;
}[] = [
    {
        id: 'bus',
        type: ClientUnit.Bus,
        num: '2Е',
        coords: [45.01881, 38.9862],
        course: 102,
        accessibility: true,
    },
    { id: 'troll', type: ClientUnit.Troll, num: '7', coords: [45.01937, 38.9847], course: 330 },
    { id: 'tram', type: ClientUnit.Tram, num: '15', coords: [45.02069, 38.98948], course: 161 },
];

function vehicleIcon(vehicle: (typeof PREVIEW_VEHICLES)[number]) {
    const course = ((vehicle.course % 360) + 360) % 360;
    return new L.DivIcon({
        iconSize: [33, 28],
        iconAnchor: [16.5, 14],
        className: vehicleStyles.MapVehicle,
        html: ReactDOMServer.renderToStaticMarkup(
            <MapVehicleMarker
                // Свой префикс id: основная карта ищет маркеры машин по id в документе, и
                // совпадение с ней перехватило бы её анимацию движения.
                id={`preview-${vehicle.id}`}
                routeNumber={vehicle.num}
                type={vehicle.type}
                accessibility={Boolean(vehicle.accessibility)}
                isCourseEast={course > EAST_COURSE_RANGE.left && course < EAST_COURSE_RANGE.right}
                course={vehicle.course}
            />,
        ),
    });
}

function PreviewVehicles() {
    const icons = useMemo(() => PREVIEW_VEHICLES.map(vehicleIcon), []);
    const { layers, lowFloorOnly } = useMapPreferences();

    return (
        <>
            {PREVIEW_VEHICLES.map((vehicle, index) =>
                !layers[vehicle.type] || (lowFloorOnly && !vehicle.accessibility) ? null : (
                <Marker
                    key={vehicle.id}
                    position={vehicle.coords}
                    icon={icons[index]}
                    interactive={false}
                />
                ),
            )}
        </>
    );
}

/**
 * Мини-карта в настройках: видно, как меняются размеры значков, не закрывая панель (на
 * телефоне она закрывает основную карту целиком). Фиксированный кадр - двигать и
 * масштабировать нельзя, на ней настоящие остановки и вокзалы этого места и моковые
 * неподвижные машины. Размеры берутся из тех же CSS-переменных --icon-scale-*, так что
 * ползунки меняют и её, и основную карту одновременно. Клики по объектам выключены, чтобы
 * случайное нажатие не открыло карточку остановки вместо настроек.
 */
export function MapSettingsPreview() {
    const { layers } = useMapPreferences();

    return (
        <div className={styles.MapSettingsPreview} aria-hidden="true">
            <MapContainer
                center={PREVIEW_CENTER}
                zoom={PREVIEW_ZOOM}
                minZoom={PREVIEW_ZOOM}
                maxZoom={PREVIEW_ZOOM}
                dragging={false}
                touchZoom={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                boxZoom={false}
                keyboard={false}
                zoomControl={false}
                attributionControl={false}
                className={styles.MapSettingsPreviewMap}
            >
                <MapVectorBasemap />
                {layers.stops && <MapStops />}
                {layers.rail && <MapRail />}
                <PreviewVehicles />
            </MapContainer>
        </div>
    );
}
