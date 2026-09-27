/**
 * Горячие клавиши десктопной версии. Один список - для обработчика (components/Map/Hotkeys),
 * панели «Горячие клавиши» и подсказок в title кнопок, чтобы они не расходились.
 *
 * Клавиши сверяются по event.code - физической клавише, поэтому работают и в русской
 * раскладке (R = К, N = Т и т. д.). Кнопки, которые нажимает клавиша, помечены
 * data-hotkey="<id>": обработчик кликает по ним, и поведение (открыть/закрыть панель,
 * подсветка кнопки) ровно то же, что у мыши.
 */

export type HotkeyId =
    | 'search'
    | 'journey'
    | 'nearby'
    | 'favorites'
    | 'location'
    | 'zoom-in'
    | 'zoom-out'
    | 'theme'
    | 'settings'
    | 'info'
    | 'close'
    | 'help';

export interface Hotkey {
    id: HotkeyId;
    /** event.code клавиш, которые запускают действие. */
    codes: string[];
    /** Shift: true - нужен («?»), 'any' - не важен («+» на английской раскладке набирается с
        Shift, на русской и на цифровом блоке - без), по умолчанию - без Shift. */
    shift?: boolean | 'any';
    /** Как клавиша подписана в панели и в title. */
    label: string[];
    title: string;
}

export const HOTKEYS: Hotkey[] = [
    { id: 'search', codes: ['Slash'], label: ['/'], title: 'Поиск' },
    { id: 'journey', codes: ['KeyR'], label: ['R'], title: 'Маршрут' },
    { id: 'nearby', codes: ['KeyN'], label: ['N'], title: 'Остановки рядом со мной' },
    { id: 'favorites', codes: ['KeyF'], label: ['F'], title: 'Избранное' },
    { id: 'location', codes: ['KeyL'], label: ['L'], title: 'Моё местоположение' },
    {
        id: 'zoom-in',
        codes: ['Equal', 'NumpadAdd'],
        shift: 'any',
        label: ['+'],
        title: 'Приблизить',
    },
    {
        id: 'zoom-out',
        codes: ['Minus', 'NumpadSubtract'],
        shift: 'any',
        label: ['−'],
        title: 'Отдалить',
    },
    { id: 'theme', codes: ['KeyT'], label: ['T'], title: 'Светлая или тёмная тема' },
    { id: 'settings', codes: ['Comma'], label: [','], title: 'Настройки' },
    { id: 'info', codes: ['KeyI'], label: ['I'], title: 'Как пользоваться картой' },
    {
        id: 'close',
        codes: ['Escape'],
        label: ['Esc'],
        title: 'Закрыть карточку или выйти из поиска',
    },
    { id: 'help', codes: ['Slash'], shift: true, label: ['?'], title: 'Горячие клавиши' },
];

const byId = new Map(HOTKEYS.map((hotkey) => [hotkey.id, hotkey]));

/** Десктоп - есть мышь и наведение. На телефонах и планшетах клавиши не включаем. */
export const hotkeysAvailable = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** «Маршрут (R)» - подсказка кнопки с её клавишей. */
export const withHotkey = (title: string, id: HotkeyId) => {
    const hotkey = byId.get(id);
    return hotkey ? `${title} (${hotkey.label.join(' / ')})` : title;
};

/** Сочетание для поиска на Mac и остальных системах. */
export const searchShortcutLabel = () =>
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
        ? '⌘ K'
        : 'Ctrl K';
