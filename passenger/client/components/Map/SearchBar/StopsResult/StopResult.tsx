import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames/bind';
import { useSelector } from 'react-redux';

import { Stop } from 'transport-common/types/masstrans';

import { State } from 'common/types/state';
import { useOpenStop } from 'components/Map/Stops/useOpenStop';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';
import { useStopDirections } from 'hooks/useStopDirections';

import styles from './StopResult.module.css';

const cn = classNames.bind(styles);

export function MapSearchBarStopResult({ type, stopId, title }: Stop) {
    const currentStop = useSelector((state: State) => state.publicTransport.currentStop);
    const direction = useStopDirections()?.get(stopId);

    const openStop = useOpenStop();
    const setSelectedStop = useCallback(() => openStop(stopId), [openStop, stopId]);

    const isSelected = useMemo(() => {
        return currentStop === stopId;
    }, [currentStop, stopId]);

    return (
        <button
            className={cn(styles.MapSearchBarStopResult__wrapper, {
                [styles.MapSearchBarStopResult__wrapper_selected]: isSelected,
            })}
            onClick={() => setSelectedStop()}
        >
            <TransportIcon type={type} variant="stop" alt="" />
            <div className={cn(styles.MapSearchBarStopResult__body)}>
                <p className={cn(styles.MapSearchBarStopResult__text)}>{title}</p>
                {direction && (
                    <small className={cn(styles.MapSearchBarStopResult__direction)}>
                        {'terminal' in direction ? (
                            'Конечная'
                        ) : (
                            <>
                                <b className={cn(styles.MapSearchBarStopResult__visuallyHidden)}>
                                    Следующая остановка:
                                </b>
                                <i aria-hidden="true">→ </i>
                                {direction.next}
                            </>
                        )}
                    </small>
                )}
            </div>
        </button>
    );
}
