import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

export interface Favorites {
    stopIds: string[];
    routeIds: number[];
    /** Свои названия избранных остановок: «Дом», «Работа» (TASK-212). */
    stopNames: Record<string, string>;
}

interface FavoritesContextValue extends Favorites {
    isStopFavorite: (stopId: string) => boolean;
    isRouteFavorite: (routeId: number) => boolean;
    toggleStop: (stopId: string) => void;
    toggleRoute: (routeId: number) => void;
    /** Заменить избранное целиком - импорт из файла в настройках (TASK-204). */
    replaceFavorites: (favorites: Favorites) => void;
    /** Задать своё название остановке; пустая строка возвращает официальное. */
    renameStop: (stopId: string, name: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const STORAGE_KEY = 'favorites';

const EMPTY: Favorites = { stopIds: [], routeIds: [], stopNames: {} };

export const STOP_NAME_MAX_LENGTH = 40;

// Храним только идентификаторы, а не снимок остановки/маршрута: названия и конечные точки
// берутся из тех же источников, что и обычный поиск (stops лежат в publicTransport,
// маршруты - massTransApi.getRoutesList), поэтому не протухают. Обратная сторона: если
// остановку или маршрут убрали из данных, строка просто не отрисуется.
export function parseFavorites(raw: string | null): Favorites {
    if (!raw) {
        return EMPTY;
    }

    try {
        const parsed = JSON.parse(raw);

        return {
            stopIds: Array.isArray(parsed?.stopIds) ? parsed.stopIds.filter(isString) : [],
            routeIds: Array.isArray(parsed?.routeIds) ? parsed.routeIds.filter(isNumber) : [],
            stopNames: parseStopNames(parsed?.stopNames),
        };
    } catch (e) {
        return EMPTY;
    }
}

function parseStopNames(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>)
            .filter((entry): entry is [string, string] => isString(entry[1]) && Boolean(entry[1].trim()))
            .map(([stopId, name]) => [stopId, name.trim().slice(0, STOP_NAME_MAX_LENGTH)]),
    );
}

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

// Избранное живёт в localStorage: на пассажирской стороне нет ни аккаунта, ни авторизации,
// так что привязать его не к чему. Тот же приём, что у ThemeProvider, - гидратация в эффекте,
// а не при создании стейта, иначе на сервере не будет localStorage.
export function FavoritesProvider({ children }: { children: ReactNode }) {
    const [favorites, setFavorites] = useState<Favorites>(EMPTY);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        try {
            setFavorites(parseFavorites(localStorage.getItem(STORAGE_KEY)));
        } catch (e) {}

        setIsHydrated(true);
    }, []);

    useEffect(() => {
        // До гидратации в состоянии пусто - без этой проверки первый же рендер затёр бы
        // сохранённое избранное пустым объектом.
        if (!isHydrated) {
            return;
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
        } catch (e) {}
    }, [favorites, isHydrated]);

    const value = useMemo<FavoritesContextValue>(
        () => ({
            ...favorites,
            isStopFavorite: (stopId) => favorites.stopIds.includes(stopId),
            isRouteFavorite: (routeId) => favorites.routeIds.includes(routeId),
            toggleStop: (stopId) =>
                setFavorites((prev) => {
                    const stopIds = toggle(prev.stopIds, stopId);
                    // Убрали из избранного - своё название больше не нужно.
                    const { [stopId]: _removed, ...rest } = prev.stopNames;
                    const stopNames = stopIds.includes(stopId) ? prev.stopNames : rest;

                    return { ...prev, stopIds, stopNames };
                }),
            toggleRoute: (routeId) =>
                setFavorites((prev) => ({ ...prev, routeIds: toggle(prev.routeIds, routeId) })),
            replaceFavorites: (next) => setFavorites(next),
            renameStop: (stopId, name) =>
                setFavorites((prev) => {
                    const { [stopId]: _previous, ...rest } = prev.stopNames;
                    const trimmed = name.trim().slice(0, STOP_NAME_MAX_LENGTH);

                    return { ...prev, stopNames: trimmed ? { ...rest, [stopId]: trimmed } : rest };
                }),
        }),
        [favorites],
    );

    return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
    const ctx = useContext(FavoritesContext);

    if (!ctx) {
        throw new Error('useFavorites must be used within FavoritesProvider');
    }

    return ctx;
}
