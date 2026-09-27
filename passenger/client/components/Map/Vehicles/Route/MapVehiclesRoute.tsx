import React, { useRef } from 'react';
import classNames from 'classnames/bind';
import { ClientUnit } from 'transport-common/types/masstrans';

import { VEHICLE_TYPE_COLORS } from 'common/constants/colors';
import { useSmoothCorners } from 'hooks/useSmoothCorners';

import styles from './MapVehiclesRoute.module.css';

const cn = classNames.bind(styles);

export interface MapVehiclesRouteProps {
    type: ClientUnit;
    num: string;
    size?: 'xs' | 's' | 'm' | 'l';
}

export function MapVehiclesRoute({ type, num, size = 'm' }: MapVehiclesRouteProps) {
    const routeRef = useRef<HTMLDivElement>(null);

    useSmoothCorners(routeRef);

    return (
        <div
            ref={routeRef}
            className={cn(styles.MapVehiclesRoute, styles[`MapVehiclesRouteSize_${size}`])}
            style={{
                backgroundColor: VEHICLE_TYPE_COLORS[type],
            }}
        >
            {num}
        </div>
    );
}
