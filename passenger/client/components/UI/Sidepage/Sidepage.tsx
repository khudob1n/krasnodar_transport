import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { waapi } from 'animejs';
import classNames from 'classnames/bind';

import { sidebarService } from 'services/sidebar/sidebar';
import { CardPosition, useSwipeableCard } from 'hooks/useSwipeableCard';
import { useDisablePropagation } from 'hooks/useDisablePropagation';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { prefersReducedMotion } from 'utils/reducedMotion';

import Close from 'public/icons/close.svg';

import styles from './Sidepage.module.css';

const cn = classNames.bind(styles);

export function Sidepage({ children }: React.PropsWithChildren) {
    const ref = useRef<HTMLDivElement>(null);

    useDisablePropagation(ref);
    useSmoothCorners(ref);

    const [currentPosition, onDragEnd, onDrag] = useSwipeableCard(CardPosition.HalfOpen);

    // Появление карточки (остановка, маршрут, машина, метро, станция, «Маршрут»): её блоки по
    // очереди выезжают снизу. Содержимое пересоздаётся при каждом открытии (ключ в
    // sidebarService.open) - по ключу анимация и играет, а не на обновление данных. Берём
    // блоки корня карточки и внутренности [data-card-stagger]. waapi - как у главной: браузер
    // ведёт прозрачность и сдвиг сам, и загрузка карты анимацию не тормозит.
    const contentRef = useRef<HTMLDivElement>(null);
    const contentKey = React.isValidElement(children) ? children.key : null;
    useLayoutEffect(() => {
        const content = contentRef.current;
        if (!content || prefersReducedMotion()) return undefined;
        const targets = Array.from(
            new Set(
                content.querySelectorAll<HTMLElement>(':scope > * > *, [data-card-stagger] > *'),
            ),
        );
        if (!targets.length) return undefined;
        const animation = waapi.animate(targets, {
            opacity: [0, 1],
            translateY: ['12px', '0px'],
            duration: 420,
            // Лесенка из первых пяти блоков, остальные - вместе с пятым.
            delay: (_target, index) => Math.min(index, 4) * 50,
            ease: 'out(3)',
        });
        return () => {
            animation.revert();
        };
    }, [contentKey]);

    useEffect(() => {
        if (currentPosition === CardPosition.Hidden) {
            setTimeout(() => {
                sidebarService.close();
            }, 100);
        }
    }, [currentPosition]);

    return (
        <div
            ref={ref}
            className={cn(styles.Sidepage, styles[`Sidepage_${currentPosition}`])}
            id="Sidepage-scroll-container"
        >
            <div
                className={cn(styles.SidepageDragArea)}
                onTouchMoveCapture={onDrag}
                onTouchEndCapture={onDragEnd}
            />
            <button
                type="button"
                onClick={() => {
                    sidebarService.close();
                }}
                className={cn(styles.SidepageCloseButton)}
            >
                <span className={cn(styles.SidepageCloseButtonWrapper)}>
                    <Close className={cn(styles.SidepageCloseIcon)} />
                </span>
            </button>
            <div ref={contentRef} className={cn(styles.SidepageContent)}>
                {children}
            </div>
        </div>
    );
}
