/**
 * История поиска: что человек открывал из выдачи - остановки, маршруты, станции метро,
 * вокзалы, депо. Храним только вид и id: при показе строка собирается из свежих данных
 * тем же компонентом, что и обычная выдача. Живёт в localStorage этого браузера - как
 * удобство, а не данные: недоступен (приватный режим) - истории просто нет.
 */

export type SearchHistoryKind = 'stop' | 'route' | 'metro' | 'rail' | 'depot';

export interface SearchHistoryEntry {
    kind: SearchHistoryKind;
    id: string;
}

const STORAGE_KEY = 'searchHistory';
const MAX_ENTRIES = 8;

export function loadSearchHistory(): SearchHistoryEntry[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
        return Array.isArray(parsed)
            ? parsed.filter(
                  (entry): entry is SearchHistoryEntry =>
                      typeof entry?.kind === 'string' && typeof entry?.id === 'string',
              )
            : [];
    } catch {
        return [];
    }
}

function save(entries: SearchHistoryEntry[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // Хранилище недоступно или переполнено - история просто не запомнится.
    }
}

/** Запомнить открытый результат: он встаёт первым, повтор убирается, хвост обрезается. */
export function rememberSearch(entry: SearchHistoryEntry): SearchHistoryEntry[] {
    const next = [
        entry,
        ...loadSearchHistory().filter(
            (item) => !(item.kind === entry.kind && item.id === entry.id),
        ),
    ].slice(0, MAX_ENTRIES);
    save(next);
    return next;
}

export function clearSearchHistory() {
    save([]);
}
