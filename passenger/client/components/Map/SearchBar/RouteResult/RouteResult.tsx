import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames/bind';
import { useSelector } from 'react-redux';

import { State } from 'common/types/state';
import { RouteSearchItem } from 'api/masstrans/masstrans';
import { MapVehiclesRoute } from 'components/Map/Vehicles/Route/MapVehiclesRoute';
import { useOpenRoute } from 'components/Map/Routes/useOpenRoute';
import { getNoun } from 'utils/plural';

import styles from './RouteResult.module.css';

const cn = classNames.bind(styles);

export function MapSearchBarRouteResult(props: RouteSearchItem) {
    const currentVehicle = useSelector((state: State) => state.publicTransport.currentVehicle);

    // Обратное направление (стандартная пара "туда-обратно", есть почти у каждого маршрута)
    // не считается отдельным подмаршрутом для этой подписи - о нём и так говорит "туда – обратно"
    // в самом тексте, а переключение между ними в открытой карточке маршрута сделано иконкой
    // (см. MapRouteSidebar), без явного перечисления. Подпись нужна только когда подмаршрутов
    // реально больше двух.
    const extraDirectionsCount = props.directions.length > 2 ? props.directions.length - 1 : 0;

    const openRoute = useOpenRoute();
    const onSelect = useCallback(() => openRoute(props), [openRoute, props]);

    const isSelected = useMemo(() => {
        return (
            currentVehicle?.num === props.num &&
            props.directions.some((d) => d.routeDirection === currentVehicle?.routeDirection)
        );
    }, [currentVehicle?.num, currentVehicle?.routeDirection, props.num, props.directions]);

    return (
        <button
            className={cn(styles.MapSearchBarRouteResult__wrapper, {
                [styles.MapSearchBarRouteResult__selected]: isSelected,
            })}
            onClick={() => onSelect()}
        >
            <MapVehiclesRoute type={props.type} num={props.num} />
            <p
                className={cn(
                    styles.MapSearchBarRouteResult__text,
                    styles.MapSearchBarRouteResult__text_shallow,
                )}
            >
                {props.firstStation} – {props.lastStation}
                {extraDirectionsCount > 0 && (
                    <span className={cn(styles.MapSearchBarRouteResult__extra)}>
                        {` (и ещё ${extraDirectionsCount} ${getNoun(
                            extraDirectionsCount,
                            'подмаршрут',
                            'подмаршрута',
                            'подмаршрутов',
                        )})`}
                    </span>
                )}
            </p>
        </button>
    );
}
