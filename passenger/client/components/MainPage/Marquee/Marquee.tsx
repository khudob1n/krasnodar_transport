import React from 'react';
import classNames from 'classnames/bind';

import { MarqueeProps } from './Marquee.types';

import styles from './Marquee.module.css';

const cn = classNames.bind(styles);

// Скорость ленты задана в секундах на символ, а не общей длительностью: лента за один цикл
// проезжает ровно одну группу, и при фиксированной длительности каждое новое сообщение
// разгоняло бы её. 0.21 с/символ - та же скорость, что была у прежних трёх строк
// (154 символа с разделителями за 32 с).
const SECONDS_PER_CHARACTER = 0.21;
// Разделитель «•» с отступами по ширине примерно как несколько символов.
const SEPARATOR_CHARACTERS = 5;

export function Marquee({ items }: MarqueeProps) {
    const characters = items.reduce(
        (sum, { message }) => sum + message.length + SEPARATOR_CHARACTERS,
        0,
    );
    const duration = Math.max(20, Math.round(characters * SECONDS_PER_CHARACTER));

    // Лента едет ровно на ширину одной группы, поэтому список дублируется: когда первая
    // копия уходит влево, вторая встаёт на её место и стык не виден. Дубль скрыт от
    // скринридеров, чтобы сообщения не читались дважды.
    const line = items.map(({ id, message }) => (
        <span key={id} className={cn(styles.MarqueeItem)}>
            {message}
        </span>
    ));

    return (
        <footer
            className={cn(styles.Marquee)}
            style={{ '--MarqueeDuration': `${duration}s` } as React.CSSProperties}
        >
            <div className={cn(styles.MarqueeTrack)}>
                <div className={cn(styles.MarqueeGroup)}>{line}</div>
                <div className={cn(styles.MarqueeGroup)} aria-hidden="true">
                    {line}
                </div>
            </div>
        </footer>
    );
}
