import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { getSvgPath } from 'figma-squircle';

function setCorners(entry: ResizeObserverEntry) {
    const element = entry.target as HTMLElement;
    const styles = window.getComputedStyle(element);
    // clip-path clips the border box by default, so we measure that box directly instead of
    // entry.contentRect (which excludes border-width and produces an undersized, misaligned
    // shape on elements with a real border, e.g. MapSearchBar's transparent 4px border).
    const { width, height } = element.getBoundingClientRect();

    const clipPath = getSvgPath({
        width,
        height,
        topLeftCornerRadius: parseInt(styles.borderTopLeftRadius, 10),
        topRightCornerRadius: parseInt(styles.borderTopRightRadius, 10),
        bottomRightCornerRadius: parseInt(styles.borderBottomRightRadius, 10),
        bottomLeftCornerRadius: parseInt(styles.borderBottomLeftRadius, 10),
        cornerSmoothing: Number(styles.getPropertyValue('--smooth-corners')),
    });

    element.style.clipPath = `path('${clipPath}')`;
}

let smoothCornersObserver = null;

if ('ResizeObserver' in globalThis) {
    smoothCornersObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            setCorners(entry);
        }
    });
}

export function observeSmoothCorners(element: HTMLElement) {
    if (!smoothCornersObserver) {
        return () => {};
    }

    smoothCornersObserver.observe(element);

    return () => {
        smoothCornersObserver.unobserve(element);
    };
}

export function useSmoothCorners(elRef: MutableRefObject<HTMLElement>) {
    const observed = useRef<{ element: HTMLElement; stop: () => void } | null>(null);

    // После каждого рендера: элемент может появиться позже первого (панель, открытая из
    // кнопки) или смениться - раньше такие оставались без сглаженных углов.
    useEffect(() => {
        const element = elRef.current;
        if (element === observed.current?.element) return;
        observed.current?.stop();
        observed.current = element ? { element, stop: observeSmoothCorners(element) } : null;
    });

    useEffect(
        () => () => {
            observed.current?.stop();
            observed.current = null;
        },
        [],
    );
}
