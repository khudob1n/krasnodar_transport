import { ClientUnit, StopType } from 'transport-common/types/masstrans';
import { StrapiStop } from 'transport-common/types/strapi';

import { RouteSearchItem } from 'api/masstrans/masstrans';
import { RailStation, RailStationKind } from 'components/Map/Rail/MapRail';
import { Depot } from 'components/Map/Depots/MapDepots';

// Результаты поиска идут группами по типу транспорта - в том же порядке, что и везде в
// приложении: трамвай, троллейбус, автобус. Внутри группы маршруты - по номеру, объекты -
// по названию.
const ROUTE_TYPE_ORDER: Record<ClientUnit, number> = {
    [ClientUnit.Tram]: 0,
    [ClientUnit.Troll]: 1,
    [ClientUnit.Bus]: 2,
};

// Совмещённая остановка троллейбуса и автобуса стоит между чистыми троллейбусными и
// автобусными.
const STOP_TYPE_ORDER: Record<StopType, number> = {
    [StopType.Tram]: 0,
    [StopType.Troll]: 1,
    [StopType.TrollBus]: 2,
    [StopType.Bus]: 3,
};

const RAIL_KIND_ORDER: Record<RailStationKind, number> = {
    railway_station: 0,
    rail_stop: 0,
    bus_terminal: 1,
    airport: 2,
};

/** Для сравнения: «ё» = «е», регистр не важен - «березовский» найдёт «Берёзовский». */
export const normalizeSearch = (text: string) => text.trim().toLowerCase().replace(/ё/g, 'е');

const matches = (text: string, query: string) => normalizeSearch(text).includes(query);

const byName = (left: string, right: string) => left.localeCompare(right, 'ru', { numeric: true });

const typeOrder = <T extends string>(order: Record<T, number>, type: T) =>
    order[type] ?? Object.keys(order).length;

// «трамвай 8», «8 трамвай», «тб 5» - вид транспорта и номер в любом порядке: ищем этот
// маршрут. Одно слово вида («трамвай», «автобусы») - все маршруты этого вида. Вид угадываем
// по началу слова, пока его дописывают: «8 трамв» - уже трамвай 8, а «8 т» - трамвай 8 и
// троллейбус 8 (оба на «т»). Без номера начало слова должно быть не короче трёх букв.
const ROUTE_TYPE_NAMES: [ClientUnit, string, string[]][] = [
    [ClientUnit.Tram, 'трамвай', ['тм']],
    [ClientUnit.Troll, 'троллейбус', ['тб']],
    [ClientUnit.Bus, 'автобус', ['а', 'авт']],
];

function routeTypesOf(word: string): ClientUnit[] {
    const exact = ROUTE_TYPE_NAMES.filter(([, , short]) => short.includes(word));
    if (exact.length) return exact.map(([type]) => type);
    if (!word) return [];
    // Начало названия («трамв») или название с окончанием («трамваи», «автобусы»). Для
    // окончания хватает основы без последней буквы: «трамва-и», «трамва-я».
    return ROUTE_TYPE_NAMES.filter(
        ([, name]) => name.startsWith(word) || word.startsWith(name.slice(0, -1)),
    ).map(([type]) => type);
}

function typedRouteQuery(searchText: string): { types: ClientUnit[]; num: string | null } | null {
    const words = searchText.split(/\s+/);
    if (words.length === 1) {
        // Короткое слово («а», «тр») - это начало чего угодно, а не «все автобусы».
        const types = words[0].length > 2 ? routeTypesOf(words[0]) : [];
        return types.length ? { types, num: null } : null;
    }
    if (words.length !== 2) return null;
    const [first, second] = words;
    // Номер - слово с цифрой; вид - другое слово.
    const [typeWord, num] = /\d/.test(first) ? [second, first] : [first, second];
    if (!/\d/.test(num)) return null;
    const types = routeTypesOf(typeWord);
    return types.length ? { types, num } : null;
}

// «8» - это 8 и 8а, но не 80: после номера может идти только буква.
const sameRouteNumber = (num: string, query: string) => {
    const value = normalizeSearch(num);
    return value.startsWith(query) && !/^\d/.test(value.slice(query.length));
};

export function searchThroughRoutes(routes: RouteSearchItem[], searchText: string) {
    const typed = typedRouteQuery(searchText);

    return routes
        .filter((route) =>
            typed
                ? typed.types.includes(route.type) &&
                  (typed.num === null || sameRouteNumber(route.num, typed.num))
                : matches(route.lastStation, searchText) ||
                  matches(route.firstStation, searchText) ||
                  matches(route.num, searchText),
        )
        .sort(
            (a, b) =>
                typeOrder(ROUTE_TYPE_ORDER, a.type) - typeOrder(ROUTE_TYPE_ORDER, b.type) ||
                byName(a.num, b.num) ||
                byName(a.firstStation, b.firstStation),
        );
}

export function searchThroughStops(stops: StrapiStop[], searchText: string) {
    return stops
        .filter((stop) => matches(stop.attributes.title, searchText))
        .sort(
            (a, b) =>
                typeOrder(STOP_TYPE_ORDER, a.attributes.type) -
                    typeOrder(STOP_TYPE_ORDER, b.attributes.type) ||
                byName(a.attributes.title, b.attributes.title),
        );
}

export function searchThroughRailStations(stations: RailStation[], searchText: string) {
    return stations
        .filter((station) => matches(station.name, searchText))
        .sort(
            (a, b) =>
                typeOrder(RAIL_KIND_ORDER, a.kind) - typeOrder(RAIL_KIND_ORDER, b.kind) ||
                byName(a.name, b.name),
        );
}

// Депо ищутся и по названию («Южное»), и по виду («трамвайное депо», «автобусный парк»), и
// просто по слову «депо»/«парк» - так находятся все сразу.
const DEPOT_KIND_WORDS: Record<ClientUnit, string> = {
    [ClientUnit.Tram]: 'трамвайное депо трамвай',
    [ClientUnit.Troll]: 'троллейбусное депо троллейбус',
    [ClientUnit.Bus]: 'автобусный парк автобус автопарк депо',
};

export function searchThroughDepots(depots: Depot[], searchText: string) {
    return depots
        .filter((depot) => matches(`${depot.name} ${DEPOT_KIND_WORDS[depot.type]}`, searchText))
        .sort(
            (a, b) =>
                typeOrder(ROUTE_TYPE_ORDER, a.type) - typeOrder(ROUTE_TYPE_ORDER, b.type) ||
                byName(a.name, b.name),
        );
}
