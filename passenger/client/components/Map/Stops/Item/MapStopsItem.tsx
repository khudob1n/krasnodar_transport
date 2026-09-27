import React, { useMemo } from 'react';
import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import classNames from 'classnames/bind';
import { useDispatch, useSelector } from 'react-redux';

import { store } from 'state';
import { sidebarService } from 'services/sidebar/sidebar';
import { State } from 'common/types/state';
import { setCurrentStop } from 'state/features/public-transport';

import { MapStopsSidebar } from '../Sidebar/MapStopsSidebar';

import { MapStopsItemProps } from './MapStopsItem.types';
import { getIconObjectByTypes } from './MapStopsItem.utils';

import styles from './MapStopsItem.module.css';

const cn = classNames.bind(styles);

export function MapStopsItem({ type, id, name, coords, withLabel = false }: MapStopsItemProps) {
    const dispatch = useDispatch<typeof store.dispatch>();
    const currentStop = useSelector((state: State) => state.publicTransport.currentStop);
    const currentVehicleStops = useSelector((state: State) => state.publicTransport.vehicleStops);
    const currentVehicle = useSelector((state: State) => state.publicTransport.currentVehicle);

    const hasActiveStop = currentStop !== null;
    const isVehicleActive = Boolean(currentVehicleStops.length);
    const isActive = currentStop === id;
    // Приглушённая остановка - та, что не попала в выбранный маршрут ТС, либо любая, кроме
    // выбранной. Подпись на таких не рисуем: смысл выделения в том, чтобы убрать с карты лишнее.
    const isDimmed =
        isVehicleActive && !hasActiveStop
            ? !currentVehicleStops.includes(id)
            : hasActiveStop && !isActive;

    const icon = useMemo(() => {
        if (isVehicleActive && !hasActiveStop) {
            const isStopActive = currentVehicleStops.includes(id);

            if (isStopActive) {
                const iconObject = getIconObjectByTypes(type, currentVehicle?.type);

                return new L.DivIcon({
                    ...iconObject.selected.options,
                    className: cn(styles.MapStopsItemIcon, styles.MapStopsItemIconSelected),
                });
            }

            const iconObject = getIconObjectByTypes(type);

            return iconObject.inactive;
        }

        const iconObject = getIconObjectByTypes(type);

        let icon = iconObject.idle;

        if (!isActive && hasActiveStop) {
            icon = iconObject.inactive;
        }

        return isActive
            ? new L.DivIcon({
                  ...icon.options,
                  iconSize: [48, 48],
                  // Модификатор вида транспорта задаёт цвет обводки и пульсации выбранной
                  // остановки (см. MapStopsItemIconActive_* в стилях).
                  className: cn(
                      styles.MapStopsItemIcon,
                      styles.MapStopsItemIconActive,
                      styles[`MapStopsItemIconActive_${type}`],
                  ),
              })
            : icon;
    }, [currentStop, id, type, currentVehicleStops]);

    if (!coords) {
        return null;
    }

    return (
        <Marker
            position={coords}
            icon={icon}
            key={id}
            eventHandlers={{
                click() {
                    if (currentStop !== id) {
                        sidebarService.open({
                            component: <MapStopsSidebar type={type} name={name} stopId={id} />,
                            onClose: () => dispatch(setCurrentStop({ currentStop: null })),
                        });

                        dispatch(setCurrentStop({ currentStop: id }));
                    }
                },
            }}
        >
            {withLabel && !isDimmed ? (
                // Выбранная остановка рисуется значком 40px с обводкой 5px вместо 24px (см.
                // MapStopsItemIconActive), поэтому подпись отодвигаем дальше, чтобы не легла на него.
                <Tooltip
                    // react-leaflet создаёт подпись один раз и смену offset не применяет. Из поиска
                    // выбранная остановка монтировалась заново (её скрывало прореживание), а при
                    // клике по карте маркер тот же - и подпись оставалась на старом месте, под
                    // увеличенным значком и пульсацией. Ключ пересоздаёт подпись при выборе.
                    key={isActive ? 'active' : 'idle'}
                    permanent
                    // interactive отдаёт клик по подписи маркеру-источнику: Tooltip.onAdd
                    // вешает addEventParent(marker), и событие доходит до обработчика ниже.
                    interactive
                    // Marker гасит всплытие сам (bubblingMouseEvents: false в его опциях), а
                    // Tooltip наследует от Layer значение true - без этого клик по подписи
                    // доходил бы и до карты, где useMapEvent('click') в MapTransport закрывает
                    // карточку сразу после открытия. См. types/leaflet.d.ts про типизацию.
                    bubblingMouseEvents={false}
                    direction="right"
                    offset={[isActive ? 30 : 11, 0]}
                    className={cn(styles.MapStopsItemLabel, { MapStopsItemLabel_active: isActive })}
                >
                    {name}
                </Tooltip>
            ) : null}
        </Marker>
    );
}
