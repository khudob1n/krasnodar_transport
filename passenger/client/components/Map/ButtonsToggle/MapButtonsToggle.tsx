import React, { useRef } from 'react';

import { useSmoothCorners } from 'hooks/useSmoothCorners';

import buttonStyles from 'components/UI/MapButton/MapButton.module.css';
import styles from './MapButtonsToggle.module.css';

/**
 * Кнопка «три полосы» на телефоне: прячет и показывает столбик кнопок справа (инфо, «Рядом», настройки,
 * тема), чтобы он не закрывал карту. На компьютере кнопки всегда в ряд, шеврона нет.
 */
export function MapButtonsToggle({
    opened,
    onToggle,
    controls,
}: {
    opened: boolean;
    onToggle: () => void;
    controls: string;
}) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    useSmoothCorners(buttonRef);

    return (
        <button
            ref={buttonRef}
            type="button"
            className={`${buttonStyles.MapButton} ${styles.MapButtonsToggle}`}
            aria-expanded={opened}
            aria-controls={controls}
            aria-label={opened ? 'Скрыть кнопки' : 'Показать кнопки'}
            title={opened ? 'Скрыть кнопки' : 'Показать кнопки'}
            onClick={onToggle}
        >
            {/* Три полосы (Tabler menu-deep); раскрыли - складываются в крестик. */}
            <svg
                className={`${styles.MapButtonsToggleIcon} ${opened ? styles.MapButtonsToggleIcon_opened : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden="true"
            >
                <line className={styles.MapButtonsToggleTop} x1="4" y1="6" x2="20" y2="6" />
                <line className={styles.MapButtonsToggleMiddle} x1="7" y1="12" x2="20" y2="12" />
                <line className={styles.MapButtonsToggleBottom} x1="10" y1="18" x2="20" y2="18" />
            </svg>
        </button>
    );
}
