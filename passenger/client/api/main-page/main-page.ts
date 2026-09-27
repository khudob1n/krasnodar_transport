import { fetchApi } from 'api/utils/fetch';
import { fetchAllRecords, fetchLiveVehicles } from 'api/ekb/collections';
import { ADMIN_API_URL } from 'transport-common/strapi/constants';
import { Card } from './main-page.types';

// data/site/home_cards.json - тот же формат карточек, что Card.attributes ниже, но плоский
// (без Strapi-обёртки id/attributes) - собирается в admin/api также, как остальные
// справочные датасеты (admin/api/src/lib/collections.js), редактируется в admin/web.
interface HomeCardRecord {
    id: number;
    type: 'public' | 'car' | 'other' | 'pedestrian';
    title: string;
    url: string;
    size?: 'small' | 'large';
    headerCaption?: string;
    footerCaption?: string;
    dynamicId?: string;
}

export const MainPageApi = {
    getCards: async (): Promise<Card[]> => {
        try {
            const rows = await fetchAllRecords<HomeCardRecord>('site/home_cards');

            return rows
                .sort((a, b) => a.id - b.id)
                .map((row) => ({
                    id: row.id,
                    attributes: {
                        title: row.title,
                        titleBackgroundColor: null,
                        url: row.url,
                        backgroundImage: null,
                        backgroundImageHover: null,
                        type: row.type,
                        size: row.size || null,
                        priority: row.id,
                        cardId: null,
                        headerCaption: row.headerCaption || null,
                        footerCaption: row.footerCaption || null,
                        dynamicId: row.dynamicId || null,
                    },
                })) as any;
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    getTrafficJamsCounter: async () => {
        try {
            // Балл пробок - от нашего сервера (krd-proxy берёт его у Яндекса и кэширует), как и
            // плашка на карте. Прежний ekb-probki.vercel.app сломался, а до Vercel сервер в
            // России, где собирается главная, всё равно не достаёт.
            return await fetchApi(`${ADMIN_API_URL}/api/app/live/traffic`, { dataField: 'level' });
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    getA11yTransportCounters: async () => {
        try {
            const raw = await fetchLiveVehicles();

            const countByCode = (code: string) =>
                raw.filter((v) => v.routeType === code && v.lowFloor).length;

            return {
                buses: countByCode('А'),
                trolls: countByCode('Тб'),
                trams: countByCode('Тм'),
            };
        } catch (e) {
            console.error(e);
            return { buses: 0, trolls: 0, trams: 0 };
        }
    },

    // У нас нет отдельного датасета под бегущую строку (нет пользы заводить датасет ради
    // десятка декоративных строк) - фиксированный текст. Стилизован под объявления в салоне
    // транспорта, но всё, что сказано про сам сервис, должно оставаться правдой: карта
    // обновляется раз в несколько секунд (server/ опрашивает источник каждые 5 с), значок
    // доступности у низкопольных машин, расписание в карточках остановок.
    // Длинного тире, «ёлочек» и «ё» нет намеренно: в пиксельном шрифте табло
    // (Press Start 2P) таких глифов может не оказаться, и они выпали бы другим шрифтом.
    getMarqueeItems: async () => [
        {
            id: 1,
            attributes: {
                message:
                    'Уважаемые пассажиры! Положение транспорта на карте обновляется каждые несколько секунд',
            },
        },
        {
            id: 2,
            attributes: { message: 'Следующая остановка - ваша. Время прибытия смотрите на карте' },
        },
        {
            id: 3,
            attributes: {
                message:
                    'Уважаемые пассажиры! Уступайте места пожилым людям, пассажирам с детьми и людям с инвалидностью',
            },
        },
        {
            id: 4,
            attributes: {
                message: 'Низкопольный транспорт отмечен на карте знаком инвалидной коляски',
            },
        },
        {
            id: 5,
            attributes: {
                message:
                    'Осторожно, двери закрываются! Расписание рейсов - в карточке каждой остановки',
            },
        },
        {
            id: 6,
            attributes: {
                message:
                    'Уважаемые пассажиры! Будьте внимательны при переходе через трамвайные пути',
            },
        },
        {
            id: 7,
            attributes: {
                message: 'Любимые остановки и маршруты можно сохранить в избранное',
            },
        },
        {
            id: 8,
            attributes: {
                message: 'Трамваи, троллейбусы и автобусы - на одной карте',
            },
        },
        {
            id: 9,
            attributes: {
                message:
                    'Уважаемые пассажиры! При выходе не забывайте свои вещи. Приятной поездки!',
            },
        },
        {
            id: 10,
            attributes: {
                message: 'Некоммерческий проект, не связан с городской администрацией',
            },
        },
    ],
};
