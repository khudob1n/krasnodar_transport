// Service Worker только для уведомлений-напоминаний (services/reminders/reminders.ts): на Android
// Chrome `new Notification()` запрещён, показать уведомление можно лишь через регистрацию воркера.
// Обработчика fetch нет намеренно - воркер ничего не кеширует и на загрузку сайта не влияет.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Нажали на уведомление - возвращаем пассажира на карту (открытую вкладку или новую).
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            const open = windows.find((client) => 'focus' in client);
            return open ? open.focus() : self.clients.openWindow('/map');
        }),
    );
});
