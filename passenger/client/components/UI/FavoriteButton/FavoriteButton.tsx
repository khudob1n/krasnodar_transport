import React, { useRef } from 'react';
import classNames from 'classnames/bind';

import StarIcon from 'public/icons/star.svg';
import { useSmoothCorners } from 'hooks/useSmoothCorners';

import styles from './FavoriteButton.module.css';

const cn = classNames.bind(styles);

export interface FavoriteButtonProps {
    isActive: boolean;
    onToggle: VoidFunction;
    /** Что именно сохраняем - попадает в aria-label и title. */
    subject: 'остановку' | 'маршрут';
}

// Полноценная кнопка с подписью, а не голая звезда: одинокая звезда рядом с крестиком
// закрытия читалась как значок, а не как действие (TASK-181).
export function FavoriteButton({ isActive, onToggle, subject }: FavoriteButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    useSmoothCorners(buttonRef);
    const hint = isActive ? `Убрать ${subject} из избранного` : `Сохранить ${subject} в избранное`;

    return (
        <button
            ref={buttonRef}
            type="button"
            className={cn(styles.FavoriteButton, {
                [styles.FavoriteButton_active]: isActive,
            })}
            aria-pressed={isActive}
            title={hint}
            onClick={(event) => {
                // Кнопка живёт внутри кликабельных строк (шапка карточки маршрута, элементы
                // списка) - без этого клик заодно открывал бы или переключал сам объект.
                event.stopPropagation();
                onToggle();
            }}
        >
            <StarIcon className={cn(styles.FavoriteButtonIcon)} aria-hidden="true" />
            <span>{isActive ? 'В избранном' : 'В избранное'}</span>
        </button>
    );
}
