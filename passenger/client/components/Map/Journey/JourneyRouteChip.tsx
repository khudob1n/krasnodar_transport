import React from 'react';
import classNames from 'classnames/bind';

import { VEHICLE_TYPE_COLORS } from 'common/constants/colors';
import { MapVehiclesRoute } from 'components/Map/Vehicles/Route/MapVehiclesRoute';
import { METRO_LINE_COLOR_FALLBACK } from 'components/Map/Metro/metroNumbers';
import { Graph, JourneyMode } from 'services/journey/planner';
import { PlannedJourney, PlannedLeg } from 'services/journey/schedule';

import styles from './JourneyRouteChip.module.css';

const cn = classNames.bind(styles);

/** Цвет вида транспорта в маршруте - для плашек и линии на карте. */
export const journeyModeColor = (type: JourneyMode, metroColor?: string) =>
    type === 'metro' ? metroColor || METRO_LINE_COLOR_FALLBACK : VEHICLE_TYPE_COLORS[type];

/** Цвет этапа маршрута: поездка - цветом своего транспорта, пешком - синим (--walk). */
export const journeyLegColor = (graph: Graph | null, leg: PlannedLeg | null | undefined) =>
    leg?.kind === 'ride' ? journeyModeColor(leg.chosen.type, graph?.metro?.color) : 'var(--walk)';

/** Цвет варианта целиком - по самой долгой поездке в нём; без транспорта - пешеходный. */
export function journeyAccentColor(graph: Graph | null, journey: PlannedJourney) {
    const longest = journey.legs.reduce<PlannedLeg | null>((best, leg) => {
        if (leg.kind !== 'ride') return best;
        if (best?.kind !== 'ride') return leg;
        return leg.arrival - leg.departure > best.arrival - best.departure ? leg : best;
    }, null);
    return journeyLegColor(graph, longest);
}

/**
 * Плашка маршрута в панели «Маршрут»: номер наземного маршрута, как везде в приложении,
 * а у метро - логотип метро, как на карте и в поиске (в Екатеринбурге линия одна, номер
 * ничего не добавит).
 */
export function JourneyRouteChip({
    type,
    num,
    size,
}: {
    type: JourneyMode;
    num: string;
    size: 'xs' | 's';
}) {
    if (type !== 'metro') return <MapVehiclesRoute type={type} num={num} size={size} />;

    // Светлый и тёмный логотипы переключаются темой в CSS - как у значка входа в метро.
    return (
        <span className={cn('JourneyMetroChip', `JourneyMetroChip_${size}`)} aria-label="Метро">
            <img className={cn('JourneyMetroChipLight')} src="/icons/metro-station.svg" alt="" />
            <img
                className={cn('JourneyMetroChipDark')}
                src="/icons/metro-station-dark.svg"
                alt=""
            />
        </span>
    );
}
