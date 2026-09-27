import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import classNames from 'classnames/bind';

import { ClientUnit } from 'transport-common/types/masstrans';
import { StrapiStop } from 'transport-common/types/strapi';

import { useDisablePropagation } from 'hooks/useDisablePropagation';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { useTypingPlaceholder } from 'hooks/useTypingPlaceholder';
import { useReveal } from 'hooks/useReveal';
import { interleave, pickRandom } from 'utils/typingExamples';
import { State } from 'common/types/state';
import { massTransApi, RouteSearchItem } from 'api/masstrans/masstrans';
import { loadCollection } from 'api/ekb/collections';
import { RailStation } from 'components/Map/Rail/MapRail';
import { Depot } from 'components/Map/Depots/MapDepots';
import { useJourney } from 'services/journey/journeyStore';

import { MapSearchBarRouteResult } from './RouteResult/RouteResult';
import { MapSearchBarStopResult } from './StopsResult/StopResult';
import { MapSearchBarRailResult } from './RailResult/RailResult';
import { MapSearchBarDepotResult } from './DepotResult/DepotResult';

import { withHotkey } from 'services/hotkeys';
import {
    clearSearchHistory,
    loadSearchHistory,
    rememberSearch,
    SearchHistoryEntry,
    SearchHistoryKind,
} from 'services/searchHistory';

import styles from './SearchBar.module.css';
import {
    normalizeSearch,
    searchThroughDepots,
    searchThroughRailStations,
    searchThroughRoutes,
    searchThroughStops,
} from './SearchBar.helpers';

const cn = classNames.bind(styles);

// Что «печатается» в пустом поле поиска, пока данные не загрузились; потом - случайные
// примеры из них (randomExamples ниже).
const TYPING_EXAMPLES = [
    'Театральная площадь',
    'Галерея Краснодар',
    'Трамвай 8',
    'Аэропорт Пашковский',
    'Вокзал Краснодар-1',
    'Автобус 50',
    'Трамвайное депо',
];

// Разделы выдачи в том же порядке, в каком searchThroughRoutes сортирует маршруты.
const ROUTE_TYPE_WORD: Record<ClientUnit, string> = {
    [ClientUnit.Tram]: 'Трамвай',
    [ClientUnit.Troll]: 'Троллейбус',
    [ClientUnit.Bus]: 'Автобус',
};

/** Случайные примеры для подсказки: остановки, маршруты («Автобус 50»), вокзалы, депо. */
function randomExamples(
    stops: StrapiStop[],
    routes: RouteSearchItem[],
    rail: RailStation[],
    depots: Depot[],
) {
    return interleave([
        pickRandom(
            stops.map(({ attributes }) => attributes.title),
            4,
        ),
        pickRandom(
            routes.map((route) => `${ROUTE_TYPE_WORD[route.type]} ${route.num}`),
            4,
        ),
        pickRandom(
            rail.map(({ name }) => name),
            2,
        ),
        pickRandom(
            depots.map(({ name }) => name),
            1,
        ),
    ]);
}

const ROUTE_GROUPS: { type: ClientUnit; title: string }[] = [
    { type: ClientUnit.Tram, title: 'Трамваи' },
    { type: ClientUnit.Troll, title: 'Троллейбусы' },
    { type: ClientUnit.Bus, title: 'Автобусы' },
];

interface SearchResult {
    stops: StrapiStop[];
    routes: RouteSearchItem[];
    railStations: RailStation[];
    depots: Depot[];
}

/** Больше остановок в выдаче не рисуем: на запрос из одной буквы их больше тысячи, и список
 *  тормозил. Счётчик в заголовке раздела остаётся полным. */
const MAX_STOPS_SHOWN = 30;

const EMPTY_RESULT: SearchResult = {
    stops: [],
    routes: [],
    railStations: [],
    depots: [],
};

function SearchGroup({
    title,
    count,
    action,
    children,
}: {
    title: string;
    count?: number;
    /** Кнопка справа в заголовке раздела (например, «Очистить» у истории). */
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className={cn(styles.MapSearchBar__group)} aria-label={title}>
            <h3 className={cn(styles.MapSearchBar__groupTitle)}>
                {title}
                {count !== undefined && (
                    <span className={cn(styles.MapSearchBar__groupCount)}>{count}</span>
                )}
                {action}
            </h3>
            {children}
        </section>
    );
}

/** Обёртка результата: выбрали его - запоминаем в истории поиска. Сам результат не меняется. */
function Remembered({
    kind,
    id,
    onPick,
    children,
}: {
    kind: SearchHistoryKind;
    id: string | number;
    onPick: (entry: SearchHistoryEntry) => void;
    children: React.ReactNode;
}) {
    return (
        <div
            className={cn(styles.MapSearchBar__remembered)}
            onClickCapture={() => onPick({ kind, id: String(id) })}
        >
            {children}
        </div>
    );
}

/**
 * collapsed - открыта карточка (остановки, маршрута...): выдача сворачивается, чтобы не
 * закрывать её и карту, и снова показывается, когда возвращаются в поле поиска.
 */
export function MapSearchBar({ collapsed = false }: { collapsed?: boolean }) {
    const searchBarRef = useRef<HTMLDivElement>(null);
    const searchFormRef = useRef<HTMLFormElement>(null);
    const [hasSearch, setHasSearch] = useState(false);
    const [focused, setFocused] = useState(false);
    const [routes, setRoutes] = useState<RouteSearchItem[]>([]);
    const [railStations, setRailStations] = useState<RailStation[]>([]);
    const [depots, setDepots] = useState<Depot[]>([]);
    const [searchResult, setSearchResult] = useState<SearchResult>(EMPTY_RESULT);
    const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

    // localStorage читаем после монтирования: при серверной отрисовке его нет.
    useEffect(() => setHistory(loadSearchHistory()), []);
    const remember = useCallback(
        (entry: SearchHistoryEntry) => setHistory(rememberSearch(entry)),
        [],
    );

    const stops = useSelector((state: State) => state.publicTransport.stops);

    useDisablePropagation(searchBarRef);
    useSmoothCorners(searchBarRef);
    useSmoothCorners(searchFormRef);

    useEffect(() => {
        massTransApi.getRoutesList().then(setRoutes);
        loadCollection<Depot>('ground_transport/depots')
            .then(setDepots)
            .catch((error) => console.warn('Не удалось загрузить депо', error));
        loadCollection<RailStation>('rail/stations')
            .then(setRailStations)
            .catch((error) => console.warn('Не удалось загрузить железнодорожные станции', error));
    }, []);

    const onSearch = useCallback(
        (event) => {
            const searchText = normalizeSearch((event.target as HTMLInputElement).value);

            setHasSearch(Boolean(searchText));

            if (!searchText) {
                setSearchResult(EMPTY_RESULT);

                return;
            }

            const stopsSearch = searchThroughStops(stops, searchText);
            const routesSearch = searchThroughRoutes(routes, searchText);
            const railSearch = searchThroughRailStations(railStations, searchText);
            const depotSearch = searchThroughDepots(depots, searchText);

            setSearchResult({
                stops: stopsSearch,
                routes: routesSearch,
                railStations: railSearch,
                depots: depotSearch,
            });
        },
        [stops, routes, railStations, depots],
    ) as React.FormEventHandler;

    const hasResults = useMemo(
        () =>
            Boolean(
                searchResult.stops.length ||
                    searchResult.routes.length ||
                    searchResult.railStations.length ||
                    searchResult.depots.length,
            ),
        [searchResult],
    );

    // Панель «Маршрут» ищет остановки своими полями - выдача общего поиска над ней только
    // отнимала бы место. Открыли панель - поиск очищаем.
    const inputRef = useRef<HTMLInputElement>(null);
    const { panelOpen: journeyOpen } = useJourney();

    useEffect(() => {
        if (!journeyOpen || !inputRef.current?.value) return;
        inputRef.current.value = '';
        setHasSearch(false);
        setSearchResult(EMPTY_RESULT);
    }, [journeyOpen]);

    // Открылась карточка (обычно - кликом по результату): выходим из поиска, выдача
    // свернётся. Вернуться к ней - нажать на поле.
    useEffect(() => {
        if (!collapsed) return;
        setFocused(false);
        if (searchBarRef.current?.contains(document.activeElement)) {
            (document.activeElement as HTMLElement).blur();
        }
    }, [collapsed]);

    const showResults = hasResults && (!collapsed || focused);

    // Пока поле пустое и не в фокусе - в нём «печатаются» примеры запросов (и при открытой
    // карточке). В фокусе подсказку прячут стили, а под полем - история поиска.
    // Случайный набор - один раз, как загрузятся остановки и маршруты (что из остального уже
    // есть - тоже в дело). Пересобирать на каждую подгрузку не надо: анимация бы сбивалась.
    const examplesReady = stops.length > 0 && routes.length > 0;
    const typingExamples = useMemo(
        () =>
            examplesReady
                ? randomExamples(stops, routes, railStations, depots)
                : TYPING_EXAMPLES,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [examplesReady],
    );
    const typing = useTypingPlaceholder(typingExamples, {
        active: !focused && !hasSearch,
    });

    // История - когда поле в фокусе и пустое. Строки собираем из свежих данных: чего уже
    // нет (маршрут отменили) или ещё не загрузилось - просто не показываем.
    const historyItems = useMemo(
        () =>
            history
                .map((entry) => {
                    const key = `${entry.kind}:${entry.id}`;
                    const wrap = (node: React.ReactNode) => (
                        <Remembered kind={entry.kind} id={entry.id} onPick={remember} key={key}>
                            {node}
                        </Remembered>
                    );
                    if (entry.kind === 'stop') {
                        const stop = stops.find(
                            ({ attributes }) => String(attributes.stopId) === entry.id,
                        );
                        return stop && wrap(<MapSearchBarStopResult {...stop.attributes} />);
                    }
                    if (entry.kind === 'route') {
                        const route = routes.find(({ routeId }) => String(routeId) === entry.id);
                        return route && wrap(<MapSearchBarRouteResult {...route} />);
                    }
                    if (entry.kind === 'rail') {
                        const station = railStations.find(({ id }) => id === entry.id);
                        return station && wrap(<MapSearchBarRailResult station={station} />);
                    }
                    const depot = depots.find(({ id }) => id === entry.id);
                    return depot && wrap(<MapSearchBarDepotResult depot={depot} />);
                })
                .filter(Boolean),
        [history, stops, routes, railStations, depots, remember],
    );
    const showHistory = focused && !hasSearch && !journeyOpen && historyItems.length > 0;

    // Выдача и «Недавние» выезжают при появлении, строки - лесенкой.
    const historyRef = useRef<HTMLDivElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    useReveal(historyRef, showHistory, { items: ':scope > section > *' });
    useReveal(resultsRef, showResults, { items: ':scope > section > *' });

    const onSubmit = useCallback((event) => {
        event.preventDefault();
    }, []) as React.FormEventHandler;

    return (
        <div
            className={cn(styles.MapSearchBar, {
                [styles.MapSearchBar_withText]: hasSearch,
            })}
            ref={searchBarRef}
        >
            <form
                ref={searchFormRef}
                className={cn(styles.MapSearchBar__form, {
                    [styles.MapSearchBar__form_withResult]: showResults || showHistory,
                })}
                onSubmit={onSubmit}
                onFocus={() => setFocused(true)}
                // Уход фокуса в саму выдачу (клик по результату) - ещё не «ушли из поиска».
                onBlur={(event) => {
                    if (!searchBarRef.current?.contains(event.relatedTarget as Node)) {
                        setFocused(false);
                    }
                }}
            >
                <input
                    ref={inputRef}
                    type="search"
                    placeholder={typing ?? 'Поиск'}
                    aria-label="Поиск"
                    title={withHotkey('Поиск', 'search')}
                    onInput={onSearch}
                    className={cn(styles.MapSearchBar__input, {
                        [styles.MapSearchBar__input_typing]: typing !== null,
                    })}
                />
            </form>
            {showHistory && (
                <div ref={historyRef} className={cn(styles.MapSearchBar__results)}>
                    <SearchGroup
                        title="Недавние"
                        action={
                            <button
                                type="button"
                                className={cn(styles.MapSearchBar__groupAction)}
                                // Не уводим фокус из поля - иначе выдача закрылась бы до клика.
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    clearSearchHistory();
                                    setHistory([]);
                                }}
                            >
                                Очистить
                            </button>
                        }
                    >
                        <div
                            onClickCapture={() => {
                                setFocused(false);
                                (document.activeElement as HTMLElement | null)?.blur();
                            }}
                        >
                            {historyItems}
                        </div>
                    </SearchGroup>
                </div>
            )}
            {showResults && (
                <div
                    ref={resultsRef}
                    className={cn(styles.MapSearchBar__results)}
                    // Выбрали результат, пока карточка уже открыта, - флаг collapsed не
                    // меняется, поэтому выходим из поиска прямо здесь.
                    onClickCapture={() => {
                        setFocused(false);
                        (document.activeElement as HTMLElement | null)?.blur();
                    }}
                >
                    {ROUTE_GROUPS.map(({ type, title }) => {
                        const groupRoutes = searchResult.routes.filter(
                            (route) => route.type === type,
                        );

                        return groupRoutes.length ? (
                            <SearchGroup title={title} count={groupRoutes.length} key={type}>
                                {groupRoutes.map((route) => (
                                    <Remembered
                                        kind="route"
                                        id={route.routeId}
                                        onPick={remember}
                                        key={route.routeId}
                                    >
                                        <MapSearchBarRouteResult {...route} />
                                    </Remembered>
                                ))}
                            </SearchGroup>
                        ) : null;
                    })}
                    {searchResult.railStations.length > 0 && (
                        <SearchGroup
                            title="Вокзалы и аэропорт"
                            count={searchResult.railStations.length}
                        >
                            {searchResult.railStations.map((station) => (
                                <Remembered
                                    kind="rail"
                                    id={station.id}
                                    onPick={remember}
                                    key={station.id}
                                >
                                    <MapSearchBarRailResult station={station} />
                                </Remembered>
                            ))}
                        </SearchGroup>
                    )}
                    {searchResult.depots.length > 0 && (
                        <SearchGroup title="Депо" count={searchResult.depots.length}>
                            {searchResult.depots.map((depot) => (
                                <Remembered
                                    kind="depot"
                                    id={depot.id}
                                    onPick={remember}
                                    key={depot.id}
                                >
                                    <MapSearchBarDepotResult depot={depot} />
                                </Remembered>
                            ))}
                        </SearchGroup>
                    )}
                    {searchResult.stops.length > 0 && (
                        <SearchGroup title="Остановки" count={searchResult.stops.length}>
                            {searchResult.stops
                                .slice(0, MAX_STOPS_SHOWN)
                                .map(({ attributes: stop }) => (
                                    <Remembered
                                        kind="stop"
                                        id={stop.stopId}
                                        onPick={remember}
                                        key={stop.stopId}
                                    >
                                        <MapSearchBarStopResult {...stop} />
                                    </Remembered>
                                ))}
                            {searchResult.stops.length > MAX_STOPS_SHOWN && (
                                <p className={cn(styles.MapSearchBar__more)}>
                                    Показаны первые {MAX_STOPS_SHOWN} — уточните запрос
                                </p>
                            )}
                        </SearchGroup>
                    )}
                </div>
            )}
        </div>
    );
}
