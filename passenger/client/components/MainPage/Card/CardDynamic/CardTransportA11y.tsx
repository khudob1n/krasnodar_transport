import React from 'react';
import classNames from 'classnames/bind';

import { useCountUp } from 'hooks/useCountUp';

import styles from './CardTransportA11y.module.css';

const cn = classNames.bind(styles);

function Counter({ value }: { value: number }) {
    const ref = useCountUp(Number(value));

    return <dd ref={ref as React.RefObject<HTMLElement>}>{Number(value)}</dd>;
}

export function CardTransportA11y({ buses, trolls, trams }) {
    return (
        <div className={cn(styles.CardTransportA11y)}>
            <dl className={cn(styles.CardTransportA11yList)}>
                <div className={cn(styles.CardTransportA11yItem)}>
                    <div
                        className={cn(
                            styles.CardTransportA11y__Icon,
                            styles.CardTransportA11y__Icon_Bus,
                        )}
                    />
                    <dt>Автобусы</dt>
                    <Counter value={buses} />
                </div>

                <div className={cn(styles.CardTransportA11yItem)}>
                    <div
                        className={cn(
                            styles.CardTransportA11y__Icon,
                            styles.CardTransportA11y__Icon_Troll,
                        )}
                    />
                    <dt>Троллейбусы</dt>
                    <Counter value={trolls} />
                </div>

                <div className={cn(styles.CardTransportA11yItem)}>
                    <div
                        className={cn(
                            styles.CardTransportA11y__Icon,
                            styles.CardTransportA11y__Icon_Tram,
                        )}
                    />
                    <dt>Трамваи</dt>
                    <Counter value={trams} />
                </div>
            </dl>
        </div>
    );
}
