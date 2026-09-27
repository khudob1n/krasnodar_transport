/**
 * Устаревшие координаты (TASK-214). Живой фид отдаёт и машины, которые давно ничего не
 * присылали (стоят в депо или потеряли связь) - у части из них координаты многочасовой
 * давности. Такие показываем заштрихованными и не двигаем, чтобы их положение не принимали
 * за текущее. navTime в фиде - UTC без суффикса Z.
 */
export const STALE_AFTER_MS = 5 * 60 * 1000;

export function navTimeAgeMs(navTime?: string, now = Date.now()): number | null {
    if (!navTime) return null;

    const time = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(navTime) ? navTime : `${navTime}Z`);

    return Number.isNaN(time) ? null : Math.max(0, now - time);
}

export function isStale(navTime?: string, now = Date.now()): boolean {
    const age = navTimeAgeMs(navTime, now);

    return age !== null && age > STALE_AFTER_MS;
}

/** «12 мин назад», «3 ч назад» - для подписи в карточке машины. */
export function formatAge(ageMs: number): string {
    const minutes = Math.round(ageMs / 60000);

    if (minutes < 60) return `${minutes} мин назад`;

    const hours = Math.floor(minutes / 60);

    return hours < 24 ? `${hours} ч назад` : 'больше суток назад';
}
