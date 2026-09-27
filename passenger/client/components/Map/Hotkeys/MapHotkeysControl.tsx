import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { waapi } from 'animejs';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import classNames from 'classnames/bind';
import { IconKeyboard } from '@tabler/icons-react';

import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { HOTKEYS, hotkeysAvailable, searchShortcutLabel, withHotkey } from 'services/hotkeys';
import { prefersReducedMotion } from 'utils/reducedMotion';

import buttonStyles from 'components/UI/MapButton/MapButton.module.css';
import styles from './MapHotkeysControl.module.css';

const cn = classNames.bind(styles);

const NAVIGATOR_KEYS = [
    { label: ['←', '→'], title: 'Шаги навигатора' },
    { label: ['Esc'], title: 'Выйти из навигатора' },
];

function Keys({ label }: { label: string[] }) {
    return (
        <span className={cn('HotkeysKeys')}>
            {label.map((key) => (
                <kbd key={key}>{key}</kbd>
            ))}
        </span>
    );
}

/** Кнопка с клавиатурой и маленькая подсказка со всеми горячими клавишами рядом с ней. */
function MapHotkeysButton() {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    useSmoothCorners(buttonRef);

    // Подсказка выезжает от кнопки (anime.js, waapi).
    useLayoutEffect(() => {
        const popover = popoverRef.current;
        if (!open || !popover || prefersReducedMotion()) return undefined;
        const animation = waapi.animate(popover, {
            opacity: [0, 1],
            translateX: ['6px', '0px'],
            duration: 180,
            ease: 'out(3)',
        });
        return () => {
            animation.revert();
        };
    }, [open]);

    // Закрыть кликом мимо и по Esc. Esc перехватываем раньше общих клавиш (MapHotkeys),
    // чтобы он закрыл подсказку, а не открытую карточку.
    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code !== 'Escape') return;
            event.preventDefault();
            setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown, true);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={cn('HotkeysControl')}>
            <button
                ref={buttonRef}
                type="button"
                className={`${buttonStyles.MapButton} ${open ? buttonStyles.MapButton_opened : ''}`}
                aria-label="Горячие клавиши"
                aria-expanded={open}
                title={withHotkey('Горячие клавиши', 'help')}
                data-hotkey="help"
                onClick={() => setOpen(!open)}
            >
                <IconKeyboard size={26} stroke={2} aria-hidden="true" />
            </button>
            {open && (
                <div
                    ref={popoverRef}
                    className={cn('HotkeysPopover')}
                    role="dialog"
                    aria-label="Горячие клавиши"
                >
                    <ul>
                        {HOTKEYS.filter(({ id }) => id !== 'help').map(({ id, label, title }) => (
                            <li key={id}>
                                <span>{title}</span>
                                <Keys
                                    label={
                                        id === 'search' ? [...label, searchShortcutLabel()] : label
                                    }
                                />
                            </li>
                        ))}
                        {NAVIGATOR_KEYS.map(({ label, title }) => (
                            <li key={title}>
                                <span>{title}</span>
                                <Keys label={label} />
                            </li>
                        ))}
                    </ul>
                    <p>Работают в любой раскладке. Открыть эту подсказку — «?»</p>
                </div>
            )}
        </div>
    );
}

/**
 * Кнопка горячих клавиш - верхняя в правой нижней колонке (над «Маршрутом»), только на
 * десктопе. Как и «Маршрут», это контрол Leaflet, в который React рисует порталом.
 */
export function MapHotkeysControl() {
    const map = useMap();
    const [container, setContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (!hotkeysAvailable()) return undefined;
        const control = new L.Control({ position: 'bottomright' });
        control.onAdd = () => {
            const element = L.DomUtil.create(
                'div',
                `leaflet-control ${styles.HotkeysLeafletControl}`,
            );
            L.DomEvent.disableClickPropagation(element);
            L.DomEvent.disableScrollPropagation(element);
            setContainer(element);
            return element;
        };
        control.addTo(map);

        return () => {
            control.remove();
            setContainer(null);
        };
    }, [map]);

    return container ? createPortal(<MapHotkeysButton />, container) : null;
}
