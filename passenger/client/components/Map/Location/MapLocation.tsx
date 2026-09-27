import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { COORDS_KRASNODAR } from 'common/constants/coords';
import { MovingMarker } from 'components/Map/leaflet-extensions/moving-marker';
import { MapUserPlacemarkControl } from 'components/Map/UserPlacemarkControl/MapUserPlacemarkControl';

import { USER_PLACEMARK_ANIMATION_DURATION, USER_ICON } from './MapLocation.constants';

// Константа, а не литерал в разметке: новый объект на каждом рендере пересоздавал контрол, а
// MapLocation рендерится на каждое движение карты (isDragging).
const CONTROL_OPTIONS: L.ControlOptions = { position: 'bottomright' };

export function MapLocation({ locateOnStart = false }: { locateOnStart?: boolean }) {
    const userMarkerRef = useRef<MovingMarker>();
    // Маркер ещё и в состоянии: контролу он нужен, чтобы по кнопке вернуть карту к пользователю,
    // а изменение ref перерисовку не вызывает - контрол навсегда оставался без маркера.
    const [userMarker, setUserMarker] = useState<MovingMarker | undefined>();
    const [isFirstFound, setIsFirstFound] = useState<boolean>(true);
    const [moveToLatLng, setMoveToLatLng] = useState<L.LatLng | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [cancelMove, setCancelMove] = useState<boolean>(false);

    const map = useMapEvents({
        locationfound(e) {
            if (isFirstFound) {
                // На карту маркер попадает только с первыми координатами - до этого он стоял
                // бы в центре города.
                userMarkerRef.current?.setLatLng(e.latlng).addTo(map);
                map.setView(e.latlng, map.getZoom());
                setIsFirstFound(false);

                return;
            }

            if (isDragging) {
                setMoveToLatLng(e.latlng);
            } else {
                userMarkerRef.current?.moveToWithDuration({
                    latlng: e.latlng,
                    duration: USER_PLACEMARK_ANIMATION_DURATION,
                });

                setCancelMove(true);
            }
        },
        locationerror(e) {
            console.error(e);

            if (isFirstFound) {
                // Местоположение так и не получили - маркер «я здесь» стоял бы в центре города,
                // будто пользователь там. Убираем его; следующее нажатие кнопки спросит снова.
                map.stopLocate();
                userMarkerRef.current?.remove();
                userMarkerRef.current = undefined;
                setUserMarker(undefined);
                map.setView(new L.LatLng(...COORDS_KRASNODAR), map.getZoom());
            }
        },
        movestart() {
            if (cancelMove) {
                userMarkerRef.current?.cancelMove();

                setCancelMove(false);
            }

            setIsDragging(true);
        },
        moveend() {
            setIsDragging(false);

            if (moveToLatLng) {
                userMarkerRef.current?.moveToWithDuration({
                    latlng: moveToLatLng,
                    duration: USER_PLACEMARK_ANIMATION_DURATION,
                });

                setMoveToLatLng(null);
            }
        },
    });

    const onClick = useCallback(() => {
        if (userMarkerRef.current) {
            return;
        }

        map.locate({
            watch: true,
            enableHighAccuracy: true,
        });

        setIsFirstFound(true);
        userMarkerRef.current = new MovingMarker(COORDS_KRASNODAR, {
            icon: USER_ICON,
            pane: 'location',
        });
        setUserMarker(userMarkerRef.current);
    }, [map]);

    // Стартовая точка «Моё местоположение» (TASK-199) - то же, что нажать кнопку
    // местоположения: при первом ответе карта перелетит к пользователю, при отказе -
    // останется в центре города (см. locationfound/locationerror выше).
    useEffect(() => {
        if (locateOnStart) onClick();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- только при открытии карты
    }, []);

    return (
        <MapUserPlacemarkControl
            options={CONTROL_OPTIONS}
            userPlacemark={userMarker}
            onClick={onClick}
        />
    );
}
