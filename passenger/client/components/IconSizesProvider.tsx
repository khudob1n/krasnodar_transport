import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

/**
 * Размеры значков на карте, которые пассажир настраивает сам (экран настроек на карте).
 *
 * Значения - множители к исходному размеру. Применяются CSS-переменными на <html>
 * (--icon-scale-*), а маркеры читают их в своих стилях: так ползунок меняет размер
 * мгновенно, без перерисовки тысяч маркеров, и Leaflet не теряет их позиции - масштаб
 * ложится на внутренний элемент маркера, а не на тот, что двигает Leaflet.
 */
export type IconSizeKey = 'all' | 'vehicles' | 'stops' | 'rail' | 'airport' | 'other';

export type IconSizes = Record<IconSizeKey, number>;

export const ICON_SIZE_KEYS: IconSizeKey[] = ['all', 'vehicles', 'stops', 'rail', 'airport', 'other'];

export const ICON_SIZE_MIN = 0.6;
export const ICON_SIZE_MAX = 1.6;
export const ICON_SIZE_STEP = 0.1;

export const DEFAULT_ICON_SIZES: IconSizes = {
    all: 1,
    vehicles: 1,
    stops: 1,
    rail: 1,
    airport: 1,
    other: 1,
};

// Ключ и имена переменных дублируются в инлайн-скрипте pages/_document.tsx - он выставляет
// их до гидрации, чтобы значки не прыгали из стандартного размера в сохранённый.
export const ICON_SIZES_STORAGE_KEY = 'icon-sizes';

export const cssVariableOf = (key: IconSizeKey) => `--icon-scale-${key}`;

const clamp = (value: number) =>
    Math.min(ICON_SIZE_MAX, Math.max(ICON_SIZE_MIN, Math.round(value * 10) / 10));

function parse(raw: string | null): IconSizes {
    try {
        const stored = JSON.parse(raw ?? '{}');
        return Object.fromEntries(
            ICON_SIZE_KEYS.map((key) => [
                key,
                typeof stored[key] === 'number' ? clamp(stored[key]) : DEFAULT_ICON_SIZES[key],
            ]),
        ) as IconSizes;
    } catch (e) {
        return DEFAULT_ICON_SIZES;
    }
}

interface IconSizesContextValue {
    sizes: IconSizes;
    setSize: (key: IconSizeKey, value: number) => void;
    reset: () => void;
    isDefault: boolean;
}

const IconSizesContext = createContext<IconSizesContextValue | null>(null);

export function IconSizesProvider({ children }: { children: ReactNode }) {
    const [sizes, setSizes] = useState<IconSizes>(DEFAULT_ICON_SIZES);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        try {
            setSizes(parse(localStorage.getItem(ICON_SIZES_STORAGE_KEY)));
        } catch (e) {}
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        // До чтения localStorage в стейте стоят значения по умолчанию - если записать их
        // сразу, они затёрли бы и сохранённые настройки, и переменные из _document.
        if (!isHydrated) return;

        const root = document.documentElement;
        ICON_SIZE_KEYS.forEach((key) => root.style.setProperty(cssVariableOf(key), String(sizes[key])));
        try {
            localStorage.setItem(ICON_SIZES_STORAGE_KEY, JSON.stringify(sizes));
        } catch (e) {}
    }, [sizes, isHydrated]);

    const setSize = useCallback((key: IconSizeKey, value: number) => {
        setSizes((prev) => ({ ...prev, [key]: clamp(value) }));
    }, []);

    const reset = useCallback(() => setSizes(DEFAULT_ICON_SIZES), []);

    const value = useMemo(
        () => ({
            sizes,
            setSize,
            reset,
            isDefault: ICON_SIZE_KEYS.every((key) => sizes[key] === DEFAULT_ICON_SIZES[key]),
        }),
        [sizes, setSize, reset],
    );

    return <IconSizesContext.Provider value={value}>{children}</IconSizesContext.Provider>;
}

export function useIconSizes() {
    const ctx = useContext(IconSizesContext);
    if (!ctx) throw new Error('useIconSizes must be used within IconSizesProvider');
    return ctx;
}
