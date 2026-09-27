function getMinutesToFutureTime(time: Date) {
    const now = new Date();

    return Math.max(Math.round((time.getTime() - now.getTime()) / 1000 / 60), 0);
}

/** Дата ближайшего прибытия по строке «ЧЧ:ММ» (с переходом через полночь). */
export function getArriveDate(arriveTime: string) {
    const [hours, minutes] = arriveTime.split(':');

    const arriveDate = new Date();
    arriveDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    if (arriveDate.getTime() < Date.now() - 12 * 60 * 60 * 1000) {
        arriveDate.setDate(arriveDate.getDate() + 1);
    }

    return arriveDate;
}

export function getTimeToArrive(arriveTime: string) {
    return getMinutesToFutureTime(getArriveDate(arriveTime));
}

/**
 * Подпись прибытия - общая для карточки остановки и «Рядом»: «сейчас», «N мин» (до 15 минут,
 * дальше минуты считать неудобно - точное время) или всегда точное время (настройка TASK-202).
 */
export function formatArrival(arriveTime: string, format: 'relative' | 'absolute') {
    if (format === 'absolute') return arriveTime;
    const minutes = getTimeToArrive(arriveTime);
    if (minutes > 15) return arriveTime;
    return minutes <= 0 ? 'сейчас' : `${minutes} мин`;
}
