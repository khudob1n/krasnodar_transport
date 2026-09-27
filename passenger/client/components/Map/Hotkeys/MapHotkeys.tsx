import { useEffect } from 'react';

import { HOTKEYS, hotkeysAvailable, HotkeyId } from 'services/hotkeys';
import { sidebarService } from 'services/sidebar/sidebar';

const isTypingTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

/** Нажать видимую кнопку с data-hotkey - как мышью. */
function clickHotkeyButton(id: HotkeyId) {
    const button = Array.from(document.querySelectorAll<HTMLElement>(`[data-hotkey="${id}"]`)).find(
        (element) => element.offsetParent !== null,
    );
    button?.click();
    return Boolean(button);
}

function focusSearch() {
    const input = document.querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) return false;
    input.focus();
    input.select();
    return true;
}

/**
 * Горячие клавиши карты для десктопа (список - services/hotkeys.ts). Ничего не рисует.
 * Навигатор по шагам слушает ← → и Esc сам; его Esc помечен preventDefault, и здесь
 * такое событие пропускается.
 */
export function MapHotkeys() {
    useEffect(() => {
        if (!hotkeysAvailable()) return undefined;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.repeat) return;

            // Ctrl/⌘ K - поиск откуда угодно, даже из другого поля.
            if ((event.ctrlKey || event.metaKey) && event.code === 'KeyK') {
                if (focusSearch()) event.preventDefault();
                return;
            }
            if (event.ctrlKey || event.metaKey) return;

            // В поле ввода клавиши - это текст. Только Esc уводит фокус из поля.
            if (isTypingTarget(event.target)) {
                if (event.code === 'Escape') (event.target as HTMLElement).blur();
                return;
            }

            const hotkey = HOTKEYS.find(
                ({ codes, shift }) =>
                    codes.includes(event.code) &&
                    (shift === 'any' || Boolean(shift) === event.shiftKey),
            );
            if (!hotkey) return;

            let handled = false;
            switch (hotkey.id) {
                case 'search':
                    handled = focusSearch();
                    break;
                case 'close':
                    sidebarService.close();
                    handled = true;
                    break;
                default:
                    handled = clickHotkeyButton(hotkey.id);
            }
            if (handled) event.preventDefault();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return null;
}
