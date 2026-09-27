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
 * Настройки отображения карты из экрана «Настройки» (TASK-195): слои, фильтр низкопольного
 * транспорта, подписи, стартовая точка, «уменьшить движение», подложка, формат времени
 * прибытия, вид карточки остановки и число пересадок в поиске маршрута. Всё одним объектом в localStorage - так их проще
 * сбросить и не плодить ключи. Размеры меток и тема живут в своих провайдерах.
 */

// Метро в Краснодаре нет - слоя нет (TASK-260).
export type MapLayerKey = 'bus' | 'troll' | 'tram' | 'stops' | 'rail' | 'depots';
export type StartView = 'center' | 'location' | 'last';
export type Basemap = 'default' | 'simple';
export type ArrivalFormat = 'relative' | 'absolute';
export type StopDefaultView = 'arrivals' | 'schedule';
/** Сколько пересадок допускает поиск маршрута. */
export type MaxTransfers = 0 | 1 | 2 | 3;

export interface MapPreferences {
    layers: Record<MapLayerKey, boolean>;
    lowFloorOnly: boolean;
    /** Показывать машины, которые давно не присылали координаты (заштрихованные). */
    showStale: boolean;
    labels: boolean;
    startView: StartView;
    reduceMotion: boolean;
    basemap: Basemap;
    arrivalFormat: ArrivalFormat;
    stopDefaultView: StopDefaultView;
    maxTransfers: MaxTransfers;
}

export const MAP_PREFERENCES_STORAGE_KEY = 'map-preferences';
/** Центр и масштаб карты на момент ухода - для стартовой точки «где остановились». */
export const MAP_LAST_VIEW_STORAGE_KEY = 'map-last-view';

export const DEFAULT_MAP_PREFERENCES: MapPreferences = {
    layers: {
        bus: true,
        troll: true,
        tram: true,
        stops: true,
        rail: true,
        depots: true,
    },
    lowFloorOnly: false,
    showStale: true,
    labels: true,
    startView: 'center',
    reduceMotion: false,
    basemap: 'default',
    arrivalFormat: 'relative',
    stopDefaultView: 'arrivals',
    maxTransfers: 2,
};

const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
    options.includes(value as T) ? (value as T) : fallback;

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

// Разбираем по полям: запись могла остаться от старой версии или быть испорчена руками -
// тогда неизвестное поле берёт значение по умолчанию, а не ломает всю карту.
export function parseMapPreferences(raw: string | null): MapPreferences {
    const d = DEFAULT_MAP_PREFERENCES;
    let p: any = {};

    try {
        p = raw ? (JSON.parse(raw) ?? {}) : {};
    } catch (e) {}

    const layers = { ...d.layers };
    (Object.keys(layers) as MapLayerKey[]).forEach((key) => {
        layers[key] = bool(p.layers?.[key], d.layers[key]);
    });

    return {
        layers,
        lowFloorOnly: bool(p.lowFloorOnly, d.lowFloorOnly),
        showStale: bool(p.showStale, d.showStale),
        labels: bool(p.labels, d.labels),
        startView: oneOf(p.startView, ['center', 'location', 'last'] as const, d.startView),
        reduceMotion: bool(p.reduceMotion, d.reduceMotion),
        basemap: oneOf(p.basemap, ['default', 'simple'] as const, d.basemap),
        arrivalFormat: oneOf(p.arrivalFormat, ['relative', 'absolute'] as const, d.arrivalFormat),
        stopDefaultView: oneOf(
            p.stopDefaultView,
            ['arrivals', 'schedule'] as const,
            d.stopDefaultView,
        ),
        maxTransfers: [0, 1, 2, 3].includes(p.maxTransfers) ? p.maxTransfers : d.maxTransfers,
    };
}

/** Читает настройки синхронно - для того, что нужно до первого рендера карты (стартовая точка). */
export function readMapPreferences(): MapPreferences {
    try {
        return parseMapPreferences(localStorage.getItem(MAP_PREFERENCES_STORAGE_KEY));
    } catch (e) {
        return DEFAULT_MAP_PREFERENCES;
    }
}

interface MapPreferencesContextValue extends MapPreferences {
    setPreference: <K extends keyof MapPreferences>(key: K, value: MapPreferences[K]) => void;
    setLayer: (key: MapLayerKey, value: boolean) => void;
}

const MapPreferencesContext = createContext<MapPreferencesContextValue | null>(null);

export function MapPreferencesProvider({ children }: { children: ReactNode }) {
    const [preferences, setPreferences] = useState<MapPreferences>(DEFAULT_MAP_PREFERENCES);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setPreferences(readMapPreferences());
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (!isHydrated) return;
        try {
            localStorage.setItem(MAP_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
        } catch (e) {}
    }, [preferences, isHydrated]);

    // Атрибуты на <html> - для правил в CSS: подписи прячутся, а анимации гасятся стилями,
    // без перерисовки маркеров (их разметка собрана заранее через renderToStaticMarkup).
    useEffect(() => {
        if (!isHydrated) return;
        const root = document.documentElement;
        root.toggleAttribute('data-map-no-labels', !preferences.labels);
        root.toggleAttribute('data-reduce-motion', preferences.reduceMotion);
        window.dispatchEvent(new Event('reduce-motion-change'));
    }, [preferences.labels, preferences.reduceMotion, isHydrated]);

    const setPreference = useCallback<MapPreferencesContextValue['setPreference']>((key, value) => {
        setPreferences((prev) => ({ ...prev, [key]: value }));
    }, []);

    const setLayer = useCallback((key: MapLayerKey, value: boolean) => {
        setPreferences((prev) => ({ ...prev, layers: { ...prev.layers, [key]: value } }));
    }, []);

    const value = useMemo(
        () => ({ ...preferences, setPreference, setLayer }),
        [preferences, setPreference, setLayer],
    );

    return (
        <MapPreferencesContext.Provider value={value}>{children}</MapPreferencesContext.Provider>
    );
}

export function useMapPreferences() {
    const ctx = useContext(MapPreferencesContext);
    if (!ctx) throw new Error('useMapPreferences must be used within MapPreferencesProvider');
    return ctx;
}
