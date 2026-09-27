import React, { useCallback, useEffect, useRef } from 'react';
import classNames from 'classnames/bind';

import { useDisablePropagation } from 'hooks/useDisablePropagation';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { useSidebarPanel } from 'hooks/useSidebarPanel';
import { withHotkey } from 'services/hotkeys';
import { IconInfoCircle } from '@tabler/icons-react';

import { MapWelcomeMessage } from '../WelcomeMessage/MapWelcomeMessage';

import styles from './Info.module.css';

const cn = classNames.bind(styles);

export function Info() {
    const infoButtonRef = useRef<HTMLButtonElement>(null);
    const { isOpen, open, close } = useSidebarPanel();

    useDisablePropagation(infoButtonRef);
    useSmoothCorners(infoButtonRef);

    // Единственное место, что читает и пишет 'hasVisited' - раньше то же самое дублировал
    // MapMainContainer (см. его комментарий в истории), и оба открывали приветствие: срабатывал
    // тот, чей эффект отработал первым, а второй код был мёртвым.
    useEffect(() => {
        try {
            const hasVisited = localStorage.getItem('hasVisited');

            if (!hasVisited) {
                open(<MapWelcomeMessage />);
                localStorage.setItem('hasVisited', '1');
            }
        } catch (e) {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleSidebar = useCallback(() => {
        if (isOpen) {
            close();

            return;
        }

        open(<MapWelcomeMessage />);
    }, [isOpen, open, close]);

    return (
        <button
            ref={infoButtonRef}
            className={cn(styles.MapInfo, {
                [styles.MapInfo_opened]: isOpen,
            })}
            onClick={toggleSidebar}
            aria-label="Как пользоваться картой"
            aria-expanded={isOpen}
            title={withHotkey('Как пользоваться картой', 'info')}
            data-hotkey="info"
        >
            {/* Иконки кнопок карты - из основного набора проекта (Tabler), 26px, обводка 2. */}
            <IconInfoCircle size={26} stroke={2} aria-hidden="true" />
        </button>
    );
}
