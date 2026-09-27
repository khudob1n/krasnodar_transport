import {
    IconBus,
    IconClockHour4,
    IconDatabase,
    IconInfoCircle,
    IconMapQuestion,
} from '@tabler/icons-react';

type CardIcon = typeof IconBus;

/**
 * Иконка карточки подбирается по её адресу здесь, а не полем в данных: набор карточек на
 * главной меняется редко, а датасет site/home_cards уже залит в базу админки - добавление
 * поля потребовало бы переимпорта коллекции, стирающего правки, сделанные в админке.
 * Карточка без совпадения просто рисуется без иконки.
 */
export const CARD_ICONS: Record<string, CardIcon> = {
    // Не карта: карточка и так показывает живую карту, иконка карты на ней ничего не
    // добавляет. Смысл карточки - транспорт, который по этой карте едет.
    '/map': IconBus,
    '/o-proekte': IconInfoCircle,
    // Карта с вопросом - ровно «как пользоваться картой».
    '/kak-chitat-kartu': IconMapQuestion,
    '/istochniki-dannyh': IconDatabase,
    '/raspisanie-metro': IconClockHour4,
};
