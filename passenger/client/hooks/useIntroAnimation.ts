import { RefObject, useEffect, useLayoutEffect } from 'react';
import { stagger, waapi } from 'animejs';
import { prefersReducedMotion } from 'utils/reducedMotion';

// На сервере layout-эффекта нет, а прятать элементы нужно именно до отрисовки, иначе
// кадр с готовой вёрсткой успеет мелькнуть до старта анимации.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Появление главной: сначала шапка, следом карточки сетки друг за другом.
 *
 * Именно waapi, а не обычный animate: тот считает кадры на главном потоке, а первые
 * секунды жизни страницы он занят инициализацией карты - паузы между кадрами доходят до
 * 6-8 секунд, и появление растягивается с полусекунды до нескольких десятков секунд.
 * WAAPI отдаёт прозрачность и трансформ браузеру, и джанк на них больше не влияет.
 */
export function useIntroAnimation(
    headerRef: RefObject<HTMLElement>,
    gridRef: RefObject<HTMLElement>,
) {
    useBeforePaint(() => {
        const header = headerRef.current;
        const grid = gridRef.current;

        if (!header || !grid) {
            return undefined;
        }

        // Медиазапрос читается здесь, а не через useReducedMotion: то состояние
        // приезжает эффектом, то есть уже после того, как эта анимация стартует.
        if (prefersReducedMotion()) {
            return undefined;
        }

        const cards = Array.from(grid.children) as HTMLElement[];
        const targets = [header, ...cards];

        // Прячем до первой отрисовки; инлайн снимаем, как только анимация доиграла.
        targets.forEach((node) => {
            node.style.opacity = '0';
        });

        const reveal = () => {
            targets.forEach((node) => node.style.removeProperty('opacity'));
        };

        const headerAnimation = waapi.animate(header, {
            opacity: [0, 1],
            translateY: ['12px', '0px'],
            duration: 500,
            ease: 'out(3)',
        });
        const cardsAnimation = waapi.animate(cards, {
            opacity: [0, 1],
            translateY: ['20px', '0px'],
            duration: 600,
            delay: stagger(60, { start: 120 }),
            ease: 'out(3)',
            onComplete: reveal,
        });

        return () => {
            headerAnimation.pause();
            cardsAnimation.pause();
            reveal();
        };
    }, [headerRef, gridRef]);
}
