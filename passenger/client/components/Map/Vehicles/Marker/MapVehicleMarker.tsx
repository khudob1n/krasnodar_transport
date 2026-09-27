import React from 'react';
import classNames from 'classnames/bind';
import { IconAlertTriangle } from '@tabler/icons-react';

import { ClientUnit } from 'transport-common/types/masstrans';

import { VEHICLE_TYPE_COLORS } from 'common/constants/colors';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';

import BusArrow from 'public/icons/bus-arrow.svg';
import TramArrow from 'public/icons/tram-arrow.svg';
import TrollArrow from 'public/icons/troll-arrow.svg';

import { MapVehicleMarkerProps } from './MapVehicleMarker.types';

import styles from './MapVehicleMarker.module.css';

const cn = classNames.bind(styles);

const ARROW_BY_TYPE = {
    [ClientUnit.Bus]: BusArrow,
    [ClientUnit.Tram]: TramArrow,
    [ClientUnit.Troll]: TrollArrow,
};

export const staleHatchId = (type: ClientUnit) => `vehicle-stale-hatch-${type}`;

/**
 * Узор штриховки для машин с устаревшими координатами: косые полосы цвета вида транспорта
 * по фону карточки. Раньше такие машины были полупрозрачными, но полупрозрачные маркеры в
 * депо наслаивались друг на друга и просвечивали кашей - штриховка непрозрачна. Узор один на
 * вид транспорта, капли ссылаются на него через fill: url(#...).
 */
export function StaleHatchPattern({ type }: { type: ClientUnit }) {
    return (
        <svg
            width="0"
            height="0"
            style={{ position: 'absolute' }}
            aria-hidden="true"
            focusable="false"
        >
            <defs>
                {/* userSpaceOnUse - в координатах пути капли, а он уменьшен в 0.465 раза:
                    период 12 даёт на экране полосы через ~5.6px. */}
                <pattern
                    id={staleHatchId(type)}
                    width="12"
                    height="12"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                >
                    <rect width="12" height="12" style={{ fill: 'var(--background-primary)' }} />
                    <rect width="5" height="12" style={{ fill: `var(--${type})`, opacity: 0.35 }} />
                </pattern>
            </defs>
        </svg>
    );
}

export function MapVehicleMarker({
    id,
    routeNumber,
    type,
    isCourseEast,
    accessibility,
    warning,
    course,
    additionalInfo = true,
    stale = false,
}: MapVehicleMarkerProps) {
    const accessibilityIcon = `/icons/${type}-accessibility.svg`;
    const color = VEHICLE_TYPE_COLORS[type];
    const ArrowIcon = ARROW_BY_TYPE[type];

    return (
        <div
            id={`vehicle-${id}-${routeNumber}`}
            style={
                {
                    transform: 'translate3d(0px, 0px, 0px)',
                    '--vehicle-stale-hatch': `url(#${staleHatchId(type)})`,
                } as React.CSSProperties
            }
            className={cn(styles.MapVehicleMarker, { MapVehicleMarker_stale: stale })}
        >
            {/* Масштаб из настроек - на отдельной обёртке: transform самого корня пишет
                анимация движения машины (MapVehiclesItem), и scale на нём растягивал бы
                этот сдвиг, уводя машину с её места. */}
            <div className={cn(styles.MapVehicleMarkerScale)}>
                <ArrowIcon
                    style={{ transform: `rotate(${course}deg)`, transformOrigin: '20px 28px' }}
                    className={cn(styles.MapVehicleMarkerArrow)}
                    id="arrow"
                />
                <div>
                    <TransportIcon
                        type={type}
                        className={cn(styles.MapVehicleMarkerIcon)}
                        style={{ color, fill: 'currentColor' }}
                        alt=""
                    />
                    {additionalInfo && (
                        <div
                            className={`${cn(styles.MapVehicleMarkerInfo)} ${
                                isCourseEast ? cn(styles.MapVehicleMarkerInfo_course_east) : ''
                            }`}
                            style={{ color }}
                        >
                            <div
                                className={`${cn(styles.MapVehicleMarkerRoute)} ${cn(
                                    styles.MapVehicleMarkerInfoItem,
                                )}`}
                            >
                                {routeNumber}
                            </div>
                            {accessibility && !warning && (
                                <div className={cn(styles.MapVehicleMarkerInfoItem)}>
                                    <picture>
                                        <source srcSet={accessibilityIcon} type="image/svg+xml" />
                                        <img
                                            className={cn(styles.MapVehicleMarkerAccessibilityIcon)}
                                            src={accessibilityIcon}
                                            alt="Vehicle low-floor icon"
                                        />
                                    </picture>
                                </div>
                            )}
                            {warning && !accessibility && (
                                <div
                                    className={cn(
                                        styles.MapVehicleMarkerInfoItem,
                                        styles.MapVehicleMarkerWarningItem,
                                    )}
                                >
                                    <IconAlertTriangle
                                        className={cn(styles.MapVehicleMarkerWarningIcon)}
                                        size={18}
                                        stroke={2.2}
                                        aria-hidden="true"
                                    />
                                </div>
                            )}
                            {warning && accessibility && (
                                <div
                                    className={`${cn(styles.MapVehicleMarkerAccessibilityWarning)}`}
                                >
                                    <div className={cn(styles.MapVehicleMarkerInfoItem)}>
                                        <picture>
                                            <source
                                                srcSet={accessibilityIcon}
                                                type="image/svg+xml"
                                            />
                                            <img
                                                className={cn(
                                                    styles.MapVehicleMarkerAccessibilityIcon,
                                                )}
                                                src={accessibilityIcon}
                                                alt="Vehicle low-floor icon"
                                            />
                                        </picture>
                                    </div>
                                    <div
                                        className={cn(
                                            styles.MapVehicleMarkerInfoItem,
                                            styles.MapVehicleMarkerWarningItem,
                                        )}
                                    >
                                        <IconAlertTriangle
                                            className={cn(styles.MapVehicleMarkerWarningIcon)}
                                            size={18}
                                            stroke={2.2}
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
