import { useEffect, useState } from 'react';

/**
 * Напоминания о подходе машины (TASK-208). Живут в памяти вкладки, а не в карточке: карточку
 * остановки можно закрыть, напоминание всё равно сработает, пока вкладка открыта. Уведомление -
 * системное (Notification API); если их запретили, напоминание не ставится, и кнопка
 * сообщает об этом.
 */
export const REMIND_BEFORE_MINUTES = 3;

type Listener = () => void;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((listener) => listener());

export function hasReminder(key: string) {
    return timers.has(key);
}

export function cancelReminder(key: string) {
    const timer = timers.get(key);
    if (timer) clearTimeout(timer);
    timers.delete(key);
    emit();
}

export function notificationsSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
}

const SW_URL = '/notifications-sw.js';

/**
 * Регистрация воркера для уведомлений (public/notifications-sw.js). На Android Chrome
 * конструктор Notification бросает «Illegal constructor» - напоминание молча не приходило.
 */
function notificationsWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker
        .register(SW_URL)
        .then(() => navigator.serviceWorker.ready)
        .catch(() => null);
}

async function showNotification(title: string, options: NotificationOptions) {
    const registration = await notificationsWorker();
    if (registration) {
        await registration.showNotification(title, options);
        return;
    }
    // eslint-disable-next-line no-new
    new Notification(title, options);
}

/** Ставит напоминание; возвращает false, если уведомления запрещены или не поддерживаются. */
export async function addReminder(
    key: string,
    fireAt: Date,
    { title, body }: { title: string; body: string },
): Promise<boolean> {
    if (!notificationsSupported()) return false;

    const permission =
        Notification.permission === 'default'
            ? await Notification.requestPermission()
            : Notification.permission;

    if (permission !== 'granted') return false;

    // Воркер - заранее, пока пассажир на странице: к моменту срабатывания он уже готов.
    notificationsWorker();
    cancelReminder(key);

    const delay = Math.max(0, fireAt.getTime() - Date.now());
    timers.set(
        key,
        setTimeout(() => {
            timers.delete(key);
            emit();
            showNotification(title, { body, icon: '/favicon-192.png', tag: key }).catch((error) =>
                console.warn('Не удалось показать напоминание', error),
            );
        }, delay),
    );
    emit();

    return true;
}

/** Состояние напоминания для кнопки - перерисовывается, когда оно ставится, отменяется или срабатывает. */
export function useReminder(key: string) {
    const [active, setActive] = useState(() => hasReminder(key));

    useEffect(() => {
        const sync = () => setActive(hasReminder(key));
        sync();
        listeners.add(sync);
        return () => {
            listeners.delete(sync);
        };
    }, [key]);

    return active;
}
