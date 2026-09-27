import React, { useCallback, useRef } from 'react';
import { IconMapPinSearch } from '@tabler/icons-react';

import { useDisablePropagation } from 'hooks/useDisablePropagation';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { useSidebarPanel } from 'hooks/useSidebarPanel';
import { withHotkey } from 'services/hotkeys';

import { MapNearbySidebar } from './MapNearbySidebar';

import buttonStyles from 'components/UI/MapButton/MapButton.module.css';

/** Кнопка «Рядом со мной» (TASK-210) - в ряду кнопок карты, как избранное. */
export function MapNearby() {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const { isOpen, open, close } = useSidebarPanel();

    useDisablePropagation(buttonRef);
    useSmoothCorners(buttonRef);

    const toggleSidebar = useCallback(() => {
        if (isOpen) {
            close();
            return;
        }

        open(<MapNearbySidebar />);
    }, [isOpen, open, close]);

    return (
        <button
            ref={buttonRef}
            type="button"
            className={`${buttonStyles.MapButton} ${isOpen ? buttonStyles.MapButton_opened : ''}`}
            aria-label="Остановки рядом со мной"
            title={withHotkey('Остановки рядом со мной', 'nearby')}
            data-hotkey="nearby"
            onClick={toggleSidebar}
        >
            <IconMapPinSearch size={26} stroke={2} aria-hidden="true" />
        </button>
    );
}
