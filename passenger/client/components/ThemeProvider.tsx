import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
/** Что выбрал пользователь: конкретную тему или «как в системе». */
export type ThemePreference = Theme | 'system';

interface ThemeContextValue {
    /** Тема, которая сейчас применена. */
    theme: Theme;
    /** Выбор пользователя - 'system' значит «следовать настройке устройства». */
    preference: ThemePreference;
    setPreference: (preference: ThemePreference) => void;
    /** Переключатель солнце/луна: всегда ставит явную противоположную тему. */
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'theme';
/** --background-primary тем (styles/colors.css) - цвет полосы браузера, как в _document. */
const THEME_COLORS: Record<Theme, string> = { light: '#ffffff', dark: '#16181c' };
const DARK_QUERY = '(prefers-color-scheme: dark)';

const systemTheme = (): Theme =>
    typeof window !== 'undefined' && window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';

// Тема light/dark на localStorage + data-theme на <html> (переключает CSS-переменные в
// styles/colors.css). В localStorage лежит выбор пользователя: 'light', 'dark' или 'system'.
// Инлайн-скрипт в pages/_document.tsx выставляет атрибут ещё до гидрации - любое значение,
// кроме light/dark, он и так понимает как «по системе», поэтому 'system' с ним совместимо и
// вспышки неверной темы на загрузке нет.
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [preference, setPreferenceState] = useState<ThemePreference>('system');
    const [system, setSystem] = useState<Theme>('light');
    // До чтения localStorage в стейте стоят значения по умолчанию (на сервере их не прочитать).
    // Эффекты записи ждут этого флага - иначе они затёрли бы и сохранённый выбор, и data-theme,
    // который уже выставил скрипт из _document.
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const media = window.matchMedia?.(DARK_QUERY);
        setSystem(systemTheme());

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'light' || stored === 'dark' || stored === 'system') {
                setPreferenceState(stored);
            }
        } catch (e) {}
        setIsHydrated(true);

        // Пока выбрана «Системная», тема меняется вместе с настройкой устройства (например,
        // автоматический переход в тёмную тему вечером).
        const sync = () => setSystem(media.matches ? 'dark' : 'light');
        media?.addEventListener('change', sync);
        return () => media?.removeEventListener('change', sync);
    }, []);

    const theme: Theme = preference === 'system' ? system : preference;

    useEffect(() => {
        if (!isHydrated) return;
        document.documentElement.setAttribute('data-theme', theme);
        // Полоса браузера и окна приложения - под выбранную тему, а не под системную: в
        // _document обе метки заданы по prefers-color-scheme, и при тёмной теме в приложении
        // на светлом телефоне полоса оставалась белой над тёмной картой.
        document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
            meta.setAttribute('content', THEME_COLORS[theme]);
        });
    }, [theme, isHydrated]);

    useEffect(() => {
        if (!isHydrated) return;
        try {
            localStorage.setItem(STORAGE_KEY, preference);
        } catch (e) {}
    }, [preference, isHydrated]);

    const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), []);

    const toggleTheme = useCallback(() => {
        setPreferenceState(theme === 'light' ? 'dark' : 'light');
    }, [theme]);

    const value = useMemo(
        () => ({ theme, preference, setPreference, toggleTheme }),
        [theme, preference, setPreference, toggleTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
