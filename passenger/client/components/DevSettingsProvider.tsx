import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Настройки для разработчиков (раздел «Для разработчиков» в настройках карты). Пока одна:
 * показывать в карточках внутренние ID остановок, маршрутов и машин - чтобы сверять объект на
 * карте с записью в данных и в админке. Хранится в localStorage, по умолчанию выключено.
 */
interface DevSettingsContextValue {
    showIds: boolean;
    setShowIds: (value: boolean) => void;
}

const STORAGE_KEY = 'dev-show-ids';

const DevSettingsContext = createContext<DevSettingsContextValue | null>(null);

export function DevSettingsProvider({ children }: { children: ReactNode }) {
    const [showIds, setShowIdsState] = useState(false);

    useEffect(() => {
        try {
            setShowIdsState(localStorage.getItem(STORAGE_KEY) === '1');
        } catch (e) {}
    }, []);

    const setShowIds = useCallback((value: boolean) => {
        setShowIdsState(value);
        try {
            localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
        } catch (e) {}
    }, []);

    const value = useMemo(() => ({ showIds, setShowIds }), [showIds, setShowIds]);

    return <DevSettingsContext.Provider value={value}>{children}</DevSettingsContext.Provider>;
}

export function useDevSettings() {
    const ctx = useContext(DevSettingsContext);
    if (!ctx) throw new Error('useDevSettings must be used within DevSettingsProvider');
    return ctx;
}
