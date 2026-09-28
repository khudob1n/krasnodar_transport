import React, { useRef } from 'react';
import { IconChevronDown } from '@tabler/icons-react';

import { useSmoothCorners } from 'hooks/useSmoothCorners';

import buttonStyles from 'components/UI/MapButton/MapButton.module.css';
import styles from './MapButtonsToggle.module.css';

/**
 * Шеврон на телефоне: прячет и показывает столбик кнопок справа (инфо, «Рядом», настройки,
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
            <IconChevronDown
                className={`${styles.MapButtonsToggleIcon} ${opened ? styles.MapButtonsToggleIcon_opened : ''}`}
                aria-hidden="true"
            />
        </button>
    );
}
