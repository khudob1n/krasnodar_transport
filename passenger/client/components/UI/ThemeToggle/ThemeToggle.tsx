import { useEffect, useRef } from 'react';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { animate } from 'animejs';

import { useTheme } from 'components/ThemeProvider';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { useThemeTransition } from 'hooks/useThemeTransition';
import { withHotkey } from 'services/hotkeys';
import styles from './ThemeToggle.module.css';
import { prefersReducedMotion } from 'utils/reducedMotion';

interface ThemeToggleProps {
    /**
     * Плавный переход цветов через anime.js (см. useThemeTransition). Включён только на
     * главной: на карте подложку MapLibre перерисовывает отдельный стиль, и она всё равно
     * сменилась бы скачком, рассинхронно с остальным интерфейсом.
     */
    smooth?: boolean;
}

export function ThemeToggle({ smooth = false }: ThemeToggleProps) {
    const { theme, toggleTheme } = useTheme();
    const smoothToggle = useThemeTransition();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const previousTheme = useRef(theme);

    useSmoothCorners(buttonRef);

    // На карте клик по кнопке всплывал до карты, а клик по карте закрывает открытую карточку
    // (остановки, маршрута) - смена темы молча её закрывала. Делаем то же, что
    // L.DomEvent.disableClickPropagation, но без импорта Leaflet: переключатель есть и на
    // главной с серверной отрисовкой. Сам click не останавливаем - до корня React он должен
    // дойти, карта пропускает его по метке _leaflet_disable_click.
    useEffect(() => {
        const button = buttonRef.current as
            | (HTMLButtonElement & { _leaflet_disable_click?: boolean })
            | null;
        if (!button) return undefined;
        button._leaflet_disable_click = true;
        const stop = (event: Event) => event.stopPropagation();
        const events = ['mousedown', 'touchstart', 'dblclick', 'contextmenu'];
        events.forEach((name) => button.addEventListener(name, stop));
        return () => events.forEach((name) => button.removeEventListener(name, stop));
    }, []);

    // Новая иконка въезжает с поворотом - только после клика, а не при восстановлении
    // сохранённой темы на загрузке (тогда переключение не плавное и крутить нечего).
    useEffect(() => {
        const changed = previousTheme.current !== theme;
        previousTheme.current = theme;
        const icon = buttonRef.current?.querySelector('svg');

        if (
            !smooth ||
            !changed ||
            !icon ||
            !buttonRef.current?.dataset.clicked ||
            prefersReducedMotion()
        ) {
            return undefined;
        }

        const animation = animate(icon, {
            rotate: [-90, 0],
            scale: [0.6, 1],
            opacity: [0, 1],
            duration: 450,
            ease: 'out(3)',
        });

        return () => {
            animation.pause();
        };
    }, [smooth, theme]);

    const Icon = theme === 'dark' ? IconSun : IconMoon;

    return (
        <button
            ref={buttonRef}
            type="button"
            className={styles.ThemeToggle}
            onClick={() => {
                if (!smooth) {
                    toggleTheme();
                    return;
                }
                buttonRef.current?.setAttribute('data-clicked', 'true');
                smoothToggle();
            }}
            aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
            title={withHotkey(theme === 'dark' ? 'Светлая тема' : 'Тёмная тема', 'theme')}
            data-hotkey="theme"
        >
            <Icon size={26} stroke={2} aria-hidden="true" />
        </button>
    );
}
