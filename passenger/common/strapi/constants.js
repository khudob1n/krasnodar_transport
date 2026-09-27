"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUEST_PAGINATION_SIZE = exports.PASSWORD = exports.EMAIL = exports.ADMIN_API_URL = exports.TILE_SERVER_URL = exports.STRAPI_URL = exports.TRANSPORT_API_URL = exports.SHARE_URL = exports.SITE_URL = void 0;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Адрес нашего сайта - для og:url/og:image в превью ссылок (pages/_document.tsx). Раньше здесь
// был домен исходного проекта (transport.ekaterinburg.city), и превью в мессенджерах вели туда.
exports.SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ||
    (IS_PRODUCTION
        ? 'https://krasnodar-transport.khudob1n.ru'
        : `http://localhost:${process.env.PORT || 3100}`);
// Адрес для ссылок «Поделиться» - посредник на Vercel (как vibecoding/ekb-transport-share
// у Екатеринбурга; для Краснодара его пока нет - без NEXT_PUBLIC_SHARE_URL ссылки ведут на сам сайт;
// TASK-245): Telegram до нашего сервера в России не дотягивается и превью не показывает, а до
// Vercel - да. Путь и параметры те же (/map?stop=…), людей посредник сразу переводит сюда.
// В разработке - сам локальный сайт.
exports.SHARE_URL = process.env.NEXT_PUBLIC_SHARE_URL ||
    undefined;
exports.TRANSPORT_API_URL = IS_PRODUCTION
    ? 'https://transport-api.ekaterinburg.city'
    : `http://localhost:${process.env.APP_PORT || 3080}`;
exports.STRAPI_URL = 'https://transport-cms.ekaterinburg.city';
exports.TILE_SERVER_URL = 'https://tiles.ekaterinburg.city';
// Наш собственный бэкенд (admin/api в корне проекта, поверх server/ и data/) - подменяет
// STRAPI_URL и TRANSPORT_API_URL выше как источник данных, см. api/masstrans/masstrans.ts,
// api/main-page/main-page.ts, api/articles/articles.ts.
// На сервере (сборка, SSR) Next ходит в API напрямую, минуя внешний домен и nginx:
// ADMIN_API_INTERNAL_URL задаётся только на сервере. В браузере - публичный адрес.
exports.ADMIN_API_URL = (typeof globalThis.window === 'undefined' &&
    process.env.ADMIN_API_INTERNAL_URL) ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL ||
    'http://localhost:8090';
// email of Authenticated User
exports.EMAIL = process.env.STRAPI_EMAIL;
// password of Authenticated User
exports.PASSWORD = process.env.STRAPI_PASSWORD;
// pagination size to request all of the data from table
exports.REQUEST_PAGINATION_SIZE = 400;
//# sourceMappingURL=constants.js.map