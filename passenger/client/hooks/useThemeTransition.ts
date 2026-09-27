import { useCallback, useEffect, useRef } from 'react';
import { animate, JSAnimation } from 'animejs';

import { useTheme } from 'components/ThemeProvider';
import { prefersReducedMotion } from 'utils/reducedMotion';

const DURATION = 450;

// Имена переменных, которые тёмная тема переопределяет, - берём прямо из таблиц стилей
// (правило :root[data-theme='dark'] в styles/colors.css), чтобы новая переменная темы
// сама попадала в анимацию, без второго списка здесь.
function themeVariableNames(): string[] {
    const names = new Set<string>();

    Array.from(document.styleSheets).forEach((sheet) => {
        let rules: CSSRuleList;
        try {
            rules = sheet.cssRules;
        } catch (e) {
            // Чужой origin (шрифты с CDN) - правила недоступны, и тем там нет.
            return;
        }

        Array.from(rules).forEach((rule) => {
            if (
                rule instanceof CSSStyleRule &&
                rule.selectorText.includes(':root') &&
                rule.selectorText.includes('data-theme')
            ) {
                Array.from(rule.style).forEach((property) => {
                    if (property.startsWith('--')) names.add(property);
                });
            }
        });
    });

    return Array.from(names);
}

// Значение custom property приходит как написано в CSS ("white", "#F2F2F2"), а anime.js
// интерполирует только цвета в числовой записи - прогоняем через probe, и браузер отдаёт rgb().
function readColors(names: string[], probe: HTMLElement): Record<string, string> {
    const rootStyle = getComputedStyle(document.documentElement);

    return Object.fromEntries(
        names.map((name) => {
            probe.style.color = rootStyle.getPropertyValue(name).trim();
            return [name, getComputedStyle(probe).color];
        }),
    );
}

// Пока идёт переход, CSS-transition элементов выключены (см. styles/globals.css).
const TRANSITION_ATTRIBUTE = 'data-theme-transition';

// Каждый переход получает свой номер, чтобы отложенное снятие атрибута от прошлого
// перехода не выключило его у нового, начатого повторным кликом.
let transitionId = 0;

function clearInline(names: string[]) {
    names.forEach((name) => document.documentElement.style.removeProperty(name));

    // CSS-transition возвращаем только через кадр: если снять атрибут в том же кадре, где
    // выставлен итоговый цвет, карточки запустят свой 160-мс переход от предыдущего кадра
    // и в самом конце снова отстанут.
    const id = transitionId;
    requestAnimationFrame(() =>
        requestAnimationFrame(() => {
            if (id === transitionId) {
                document.documentElement.removeAttribute(TRANSITION_ATTRIBUTE);
            }
        }),
    );
}

/**
 * Плавная смена темы: вместо мгновенного переключения data-theme цвета темы перетекают
 * из старых в новые.
 *
 * Анимируются сами CSS-переменные на <html>, а не отдельные элементы: всё, что на них
 * построено, меняет цвет одновременно и синхронно. Порядок такой - снять значения старой
 * темы, переключить data-theme и снять значения новой, прибить старые инлайном (инлайн на
 * <html> сильнее правила из таблицы стилей), а дальше anime.js ведёт их к новым и в конце
 * инлайн убирает, возвращая управление styles/colors.css.
 *
 * Именно animate, а не waapi, как в остальных анимациях главной: WAAPI не интерполирует
 * незарегистрированные custom properties, они бы просто перескочили в конце.
 */
export function useThemeTransition() {
    const { theme, toggleTheme } = useTheme();
    const animation = useRef<{ instance: JSAnimation; names: string[] } | null>(null);

    const stop = useCallback(() => {
        if (!animation.current) return;
        animation.current.instance.pause();
        clearInline(animation.current.names);
        animation.current = null;
    }, []);

    useEffect(() => stop, [stop]);

    return useCallback(() => {
        const root = document.documentElement;
        const next = theme === 'dark' ? 'light' : 'dark';

        // Повторный клик посреди перехода: обрываем текущий и стартуем от того, что видно
        // сейчас, - иначе цвета прыгнули бы к концу первой анимации.
        const current = animation.current;
        const midway = current
            ? Object.fromEntries(
                  current.names.map((name) => [name, root.style.getPropertyValue(name)]),
              )
            : null;
        stop();

        if (prefersReducedMotion()) {
            toggleTheme();
            return;
        }

        const names = themeVariableNames();
        if (!names.length) {
            toggleTheme();
            return;
        }

        const probe = document.createElement('span');
        probe.style.display = 'none';
        document.body.appendChild(probe);

        const from = midway ?? readColors(names, probe);
        root.setAttribute('data-theme', next);
        const to = readColors(names, probe);
        probe.remove();

        transitionId += 1;
        root.setAttribute(TRANSITION_ATTRIBUTE, '');
        names.forEach((name) => root.style.setProperty(name, from[name]));
        // ThemeProvider сам выставит тот же data-theme и сохранит выбор.
        toggleTheme();

        const instance = animate(root, {
            ...Object.fromEntries(names.map((name) => [name, [from[name], to[name]]])),
            duration: DURATION,
            ease: 'inOutQuad',
            onComplete: () => {
                clearInline(names);
                animation.current = null;
            },
        });
        animation.current = { instance, names };
    }, [stop, theme, toggleTheme]);
}
