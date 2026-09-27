import { RefObject, useCallback } from 'react';
import { waapi } from 'animejs';
import { prefersReducedMotion } from 'utils/reducedMotion';

const LIFT = '-4px';
const REST = '0px';
const DURATION = 220;

/**
 * Подъём элемента под курсором.
 *
 * waapi, а не обычный animate: трансформ карточки уже ведёт WAAPI-анимация появления,
 * и второй, главнопоточный, механизм анимации той же величины до элемента не доходит.
 * Медиазапросы проверяются в момент события - обработчик и так вызывается по действию
 * пользователя, лишний ререндер ради этого не нужен.
 */
export function useHoverLift(ref: RefObject<HTMLElement>) {
    const lift = useCallback(
        (translateY: string) => {
            const node = ref.current;

            if (
                !node ||
                !window.matchMedia('(hover: hover)').matches ||
                prefersReducedMotion()
            ) {
                return;
            }

            waapi.animate(node, {
                translateY,
                duration: DURATION,
                ease: 'out(3)',
                persist: true,
            });
        },
        [ref],
    );

    const onMouseEnter = useCallback(() => lift(LIFT), [lift]);
    const onMouseLeave = useCallback(() => lift(REST), [lift]);

    return { onMouseEnter, onMouseLeave };
}
