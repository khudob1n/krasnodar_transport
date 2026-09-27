const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Нужно ли обойтись без анимаций: так просит система или включена настройка «Уменьшить
 * движение» (атрибут data-reduce-motion на <html> ставят MapPreferencesProvider и ещё до
 * гидрации скрипт в _document). Читается в момент вызова, поэтому годится и для анимаций,
 * которые стартуют раньше эффектов.
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;

    return (
        document.documentElement.hasAttribute('data-reduce-motion') ||
        window.matchMedia(QUERY).matches
    );
}

/** Подписка на изменения: и системной настройки, и нашей. Возвращает отписку. */
export function onReducedMotionChange(callback: () => void): () => void {
    const media = window.matchMedia(QUERY);
    media.addEventListener('change', callback);
    window.addEventListener('reduce-motion-change', callback);

    return () => {
        media.removeEventListener('change', callback);
        window.removeEventListener('reduce-motion-change', callback);
    };
}
