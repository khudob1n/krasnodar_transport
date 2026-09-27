import classNames from 'classnames/bind';
import React from 'react';

import { useCountUp } from 'hooks/useCountUp';

import styles from './CardTrafficJams.module.css';

const cn = classNames.bind(styles);
const getTrafficLightByScore = (score: any) => {
    const scoreNumber = Number(score);
    if (scoreNumber < 4) {
        return styles.CardTrafficLight_Green;
    } else if (scoreNumber < 7) {
        return styles.CardTrafficLight_Yellow;
    } else {
        return styles.CardTrafficLight_Red;
    }
};
export function CardTrafficJams({ score }) {
    const scoreNumber = Number(score);
    const counterRef = useCountUp(scoreNumber);

    return (
        <div
            className={cn(styles.CardTrafficLight, getTrafficLightByScore(score))}
            ref={counterRef as React.RefObject<HTMLDivElement>}
        >
            {scoreNumber}
        </div>
    );
}
