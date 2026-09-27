import React from 'react';
import classNames from 'classnames/bind';

import { useJourney } from 'services/journey/journeyStore';

import { journeyModeColor } from './JourneyRouteChip';
import { metroCarText } from './journeyText';

import styles from './JourneyMetroCars.module.css';

const cn = classNames.bind(styles);

// В Екатеринбурге поезда из четырёх вагонов.
const CARS = [0, 1, 2, 3];

/**
 * Где садиться в метро: плашка со схемой поезда (головной вагон всегда слева), где
 * подсвечен вагон у нужного выхода, и короткой подписью справа. Схема - обычная вёрстка, без своих SVG.
 */
export function JourneyMetroCars({
    hint,
}: {
    hint: { end: 'head' | 'tail'; entrance: number | null };
}) {
    const { graph } = useJourney();
    const target = hint.end === 'head' ? 0 : CARS.length - 1;
    const text = metroCarText(hint);

    return (
        <span
            className={cn('JourneyMetroCars')}
            style={
                {
                    '--MetroLineColor': journeyModeColor('metro', graph?.metro?.color),
                } as React.CSSProperties
            }
        >
            <span className={cn('JourneyMetroCarsTrain')} aria-hidden="true">
                {CARS.map((car) => (
                    <span
                        key={car}
                        className={cn('JourneyMetroCar', {
                            JourneyMetroCar_head: car === 0,
                            JourneyMetroCar_target: car === target,
                        })}
                    />
                ))}
            </span>
            <span className={cn('JourneyMetroCarsText')}>
                <strong>{text.title}</strong>
                <span>{text.note}</span>
            </span>
        </span>
    );
}
