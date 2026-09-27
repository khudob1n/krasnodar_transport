import { useEffect, useRef } from 'react';
import { animate, utils } from 'animejs';

import { useReducedMotion } from './useReducedMotion';

const DURATION = 900;

/**
 * Прокручивает число от нуля до значения. Пишет напрямую в DOM, а не через состояние:
 * иначе каждый кадр анимации перерисовывал бы карточку.
 */
export function useCountUp(value: number) {
    const ref = useRef<HTMLElement>(null);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        const node = ref.current;

        if (!node || !Number.isFinite(value)) {
            return undefined;
        }

        // Дробные значения (балл пробок) округляем до десятых, счётчики машин - до целых.
        const decimals = Number.isInteger(value) ? 0 : 1;
        const render = (current: number) => {
            node.textContent = current.toFixed(decimals);
        };

        if (reducedMotion) {
            render(value);

            return undefined;
        }

        const state = { current: 0 };
        const animation = animate(state, {
            current: value,
            duration: DURATION,
            ease: 'out(3)',
            onUpdate: () => render(state.current),
        });

        return () => {
            animation.pause();
            utils.remove(state);
        };
    }, [value, reducedMotion]);

    return ref;
}
