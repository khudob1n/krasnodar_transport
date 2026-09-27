import { RefObject, useEffect, useLayoutEffect } from 'react';
import { waapi } from 'animejs';

import { prefersReducedMotion } from 'utils/reducedMotion';

// На сервере layout-эффекта нет; прятать нужно до отрисовки, иначе мелькнёт готовый кадр.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Строк лесенкой - дальше все вместе: длинный список не должен раскрываться секунду. */
const MAX_STAGGERED = 8;

/**
 * Появление выпадающего и раскрывающегося (выдача поиска, подсказки полей, «Подробнее»,
 * скрытые остановки): блок чуть выезжает сверху и проявляется, а его строки (items -
 * селектор внутри блока) - лесенкой. Играет, когда active становится true. anime.js (waapi),
 * как остальные анимации; с «уменьшить движение» - сразу на месте.
 */
export function useReveal(
    ref: RefObject<HTMLElement>,
    active: boolean,
    { items, container = true }: { items?: string; container?: boolean } = {},
) {
    useBeforePaint(() => {
        const element = ref.current;
        if (!active || !element || prefersReducedMotion()) return undefined;

        const animations = [];
        if (container) {
            animations.push(
                waapi.animate(element, {
                    opacity: [0, 1],
                    translateY: ['-6px', '0px'],
                    duration: 220,
                    ease: 'out(3)',
                }),
            );
        }
        const rows = items ? Array.from(element.querySelectorAll<HTMLElement>(items)) : [];
        if (rows.length) {
            animations.push(
                waapi.animate(rows, {
                    opacity: [0, 1],
                    translateY: ['-4px', '0px'],
                    duration: 240,
                    delay: (_target, index) => Math.min(index, MAX_STAGGERED) * 25,
                    ease: 'out(3)',
                }),
            );
        }

        return () => animations.forEach((animation) => animation.revert());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);
}
