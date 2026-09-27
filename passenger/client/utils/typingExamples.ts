/**
 * Случайные примеры для «печатающейся» подсказки в полях поиска (hooks/useTypingPlaceholder):
 * берутся из уже загруженных остановок, маршрутов, станций - при каждом открытии страницы
 * свои. Виды чередуются, чтобы подряд не шли пять остановок.
 */

/** Короткое читаемое название: без пометок в скобках и кавычках, влезает в поле. */
const readable = (name?: string | null): name is string =>
    Boolean(name) && name!.length <= 24 && !/[()"«»]/.test(name!);

/** count случайных различных значений из списка. */
export function pickRandom(items: string[], count: number): string[] {
    const pool = Array.from(new Set(items.filter(readable)));
    const result: string[] = [];
    while (pool.length && result.length < count) {
        result.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return result;
}

/** По одному из каждой группы по кругу: остановка, маршрут, остановка, маршрут... */
export function interleave(groups: string[][]): string[] {
    const result: string[] = [];
    const longest = Math.max(0, ...groups.map((group) => group.length));
    for (let index = 0; index < longest; index += 1) {
        groups.forEach((group) => {
            if (group[index]) result.push(group[index]);
        });
    }
    return result;
}
