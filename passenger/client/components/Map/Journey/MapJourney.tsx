import React, { useRef } from 'react';
import { IconRoute } from '@tabler/icons-react';

import { useDisablePropagation } from 'hooks/useDisablePropagation';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { sidebarService } from 'services/sidebar/sidebar';
import { useJourney } from 'services/journey/journeyStore';
import { withHotkey } from 'services/hotkeys';

import { openJourneyPanel } from './openJourneyPanel';

import buttonStyles from 'components/UI/MapButton/MapButton.module.css';

/**
 * Кнопка «Маршрут» в ряду кнопок карты. Открыта ли панель, знает само состояние маршрута:
 * панель открывают и отсюда, и из карточки остановки, и по ссылке.
 */
export function MapJourney() {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const { panelOpen } = useJourney();

    useDisablePropagation(buttonRef);
    useSmoothCorners(buttonRef);

    return (
        <button
            ref={buttonRef}
            type="button"
            className={`${buttonStyles.MapButton} ${panelOpen ? buttonStyles.MapButton_opened : ''}`}
            aria-label="Маршрут"
            aria-pressed={panelOpen}
            title={withHotkey('Маршрут: от адреса или остановки', 'journey')}
            data-hotkey="journey"
            onClick={() => (panelOpen ? sidebarService.close() : openJourneyPanel())}
        >
            <IconRoute size={26} stroke={2} aria-hidden="true" />
        </button>
    );
}
