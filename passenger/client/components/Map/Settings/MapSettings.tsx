import React, { useCallback, useRef } from 'react';
import classNames from 'classnames/bind';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';

import { useDisablePropagation } from 'hooks/useDisablePropagation';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { useSidebarPanel } from 'hooks/useSidebarPanel';
import { withHotkey } from 'services/hotkeys';

import { MapSettingsSidebar } from './MapSettingsSidebar';

import buttonStyles from 'components/UI/MapButton/MapButton.module.css';

const cn = classNames.bind(buttonStyles);

/** Кнопка экрана настроек в правом верхнем углу карты - того же вида, что избранное и тема. */
export function MapSettings() {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const { isOpen, open, close } = useSidebarPanel();

    useDisablePropagation(buttonRef);
    useSmoothCorners(buttonRef);

    const toggleSidebar = useCallback(() => {
        if (isOpen) {
            close();
            return;
        }
        open(<MapSettingsSidebar />);
    }, [isOpen, open, close]);

    return (
        <button
            ref={buttonRef}
            type="button"
            className={cn(buttonStyles.MapButton, {
                [buttonStyles.MapButton_opened]: isOpen,
            })}
            aria-label="Настройки"
            aria-expanded={isOpen}
            title={withHotkey('Настройки', 'settings')}
            data-hotkey="settings"
            onClick={toggleSidebar}
        >
            <IconAdjustmentsHorizontal size={26} stroke={2} aria-hidden="true" />
        </button>
    );
}
