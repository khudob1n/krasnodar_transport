import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import classNames from 'classnames/bind';
import { useSelector } from 'react-redux';
import { IconClick, IconMapPin, IconX } from '@tabler/icons-react';

import { State } from 'common/types/state';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';
import { searchThroughStops } from 'components/Map/SearchBar/SearchBar.helpers';
import { StopType } from 'transport-common/types/masstrans';
import { StopDirection } from 'api/ekb/domain';
import {
    journeyActions,
    loadJourneyGraph,
    placeLabel,
    useJourney,
} from 'services/journey/journeyStore';
import { isMetroStop, PlannerStop } from 'services/journey/planner';
import { insideCity, isPointValue, Place, pointValue, searchPlaces } from 'services/journey/places';

import { useTypingPlaceholder } from 'hooks/useTypingPlaceholder';
import { useReveal } from 'hooks/useReveal';
import { interleave, pickRandom } from 'utils/typingExamples';

import styles from './MapJourneySidebar.module.css';

const cn = classNames.bind(styles);

const MAX_RESULTS = 7;
/** Адресов под остановками - не больше этого, остановок тогда меньше. */
const MAX_PLACES = 4;
const MY_LOCATION = 'Моё местоположение';

// Примеры, которые «печатаются» в пустом поле: что сюда можно ввести. Первая фраза - прежняя
// подсказка, она видна сразу. Этот список - пока не загрузились остановки; потом - случайные
// остановки и станции метро вперемешку с адресами (справочника адресов под рукой нет).
const TYPING_HINT = 'адрес или остановка';
const TYPING_ADDRESSES = ['Красная, 122', 'Северная, 324', 'Ставропольская, 149', 'Мира, 44', 'Кубанская набережная, 5'];
const TYPING_EXAMPLES = {
    from: ['адрес или остановка', 'Красная, 122', 'Фестивальный', 'Театральная площадь', 'Северная, 324'],
    to: ['адрес или остановка', 'Аэропорт Пашковский', 'Парк Галицкого', 'Ставропольская, 149', 'Чистяковская роща'],
};

export const directionLabel = (direction?: StopDirection) =>
    direction ? ('terminal' in direction ? 'Конечная' : `→ ${direction.next}`) : '';

interface JourneyStopFieldProps {
    label: string;
    marker: 'A' | 'B';
    field: 'from' | 'to';
    value: string | null;
    /** label - подпись места, если это не остановка. */
    onChange: (value: string | null, label?: string) => void;
    directions: Map<string, StopDirection> | null;
    autoFocus?: boolean;
}

type Option =
    | { kind: 'stop'; stopId: string; title: string; type: StopType }
    | { kind: 'metro'; stopId: string; title: string }
    | { kind: 'place'; stopId: string; title: string; subtitle: string };

/** Адреса из геокодера - с задержкой, чтобы не спрашивать на каждую букву. */
type PlaceSearchStatus = 'idle' | 'searching' | 'done' | 'error';

/**
 * Адреса из геокодера - с задержкой, чтобы не спрашивать на каждую букву. Статус нужен полю:
 * пока геокодер думает, пассажир должен это видеть, а не гадать, найдётся ли адрес.
 */
function usePlaceSearch(query: string) {
    const [places, setPlaces] = useState<Place[]>([]);
    const [status, setStatus] = useState<PlaceSearchStatus>('idle');

    useEffect(() => {
        const text = query.trim();
        if (text.length < 3) {
            setPlaces([]);
            setStatus('idle');
            return undefined;
        }
        // «Ищем» - сразу, ещё до запроса: задержка тоже часть ожидания.
        setStatus('searching');
        const controller = new AbortController();
        const timer = setTimeout(() => {
            searchPlaces(text, controller.signal)
                .then((found) => {
                    setPlaces(found);
                    setStatus('done');
                })
                .catch((error) => {
                    if (error?.name !== 'AbortError') setStatus('error');
                });
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    return { places, status };
}

function useCurrentLocation() {
    const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'far'>('idle');

    const locate = (onFound: (value: string) => void) => {
        if (!navigator.geolocation) {
            setStatus('denied');
            return;
        }
        setStatus('locating');
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                const point = { lat: coords.latitude, lng: coords.longitude };
                // Не в Краснодаре - строить маршрут отсюда нечем.
                if (!insideCity(point)) {
                    setStatus('far');
                    return;
                }
                setStatus('idle');
                onFound(pointValue(point));
            },
            () => setStatus('denied'),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
        );
    };

    return { status, locate };
}

/** Станции метро из графа поиска (id отрицательные) - в списке остановок карты их нет. */
function useMetroStations() {
    const [stations, setStations] = useState<PlannerStop[]>([]);

    useEffect(() => {
        let active = true;
        loadJourneyGraph()
            .then((graph) => {
                if (!active) return;
                setStations(
                    Array.from(graph.stops.values()).filter((stop) => isMetroStop(stop.id)),
                );
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);

    return stations;
}

function MetroIcon() {
    return <img src="/icons/metro-station.svg" alt="" className={cn(styles.JourneyStopIcon)} />;
}

/**
 * Поле выбора остановки или станции метро: выбранная остановка с подписью направления (одноимённых остановок
 * много, различаются следующей остановкой) или поиск по названию.
 */
export function JourneyStopField({
    label,
    marker,
    field,
    value,
    onChange,
    directions,
    autoFocus,
}: JourneyStopFieldProps) {
    const allStops = useSelector((state: State) => state.publicTransport.stops);
    const metroStations = useMetroStations();
    const { labels, picking } = useJourney();
    const location = useCurrentLocation();
    const [editing, setEditing] = useState(!value);
    const [query, setQuery] = useState('');
    const [inputFocused, setInputFocused] = useState(false);
    const examplesReady = Boolean(allStops?.length) && metroStations.length > 0;
    const typingExamples = useMemo(
        () =>
            examplesReady
                ? [
                      TYPING_HINT,
                      ...interleave([
                          pickRandom(
                              (allStops ?? []).map(({ attributes }) => attributes.title),
                              3,
                          ),
                          pickRandom(TYPING_ADDRESSES, 2),
                          pickRandom(
                              metroStations.map(({ name }) => name),
                              2,
                          ),
                      ]),
                  ]
                : TYPING_EXAMPLES[field],
        // Набор - один раз, как всё загрузится: пересборка сбивала бы анимацию.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [examplesReady, field],
    );
    const typing = useTypingPlaceholder(typingExamples, {
        // Печатаем и при курсоре в поле: панель сама ставит его в пустое поле при открытии,
        // и иначе примеры почти не было бы видно. Своя каретка тогда не нужна - есть настоящая.
        active: !query,
        caret: !inputFocused,
        startFull: true,
        delay: field === 'to' ? 2200 : 0,
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();

    useEffect(() => {
        setEditing(!value);
        setQuery('');
    }, [value]);

    useEffect(() => {
        if (editing && autoFocus) inputRef.current?.focus();
    }, [editing, autoFocus]);

    const { places, status: placeStatus } = usePlaceSearch(editing ? query : '');
    const isPicking = picking === field;

    const selected = useMemo((): Option | undefined => {
        if (!value) return undefined;
        if (isPointValue(value)) {
            const title = placeLabel(value, labels);
            return { kind: 'place', stopId: value, title, subtitle: '' };
        }
        if (isMetroStop(Number(value))) {
            const station = metroStations.find((stop) => String(stop.id) === value);
            return station && { kind: 'metro', stopId: value, title: station.name };
        }
        const stop = allStops?.find((item) => item.attributes.stopId === value)?.attributes;
        return stop && { kind: 'stop', stopId: stop.stopId, title: stop.title, type: stop.type };
    }, [allStops, metroStations, value, labels]);

    // Станции метро - первыми: их немного, и к ним обычно и едут.
    const results = useMemo((): Option[] => {
        const text = query.trim().toLowerCase();
        if (text.length < 2) return [];
        const metro: Option[] = metroStations
            .filter((station) => station.name.toLowerCase().includes(text))
            .map((station) => ({ kind: 'metro', stopId: String(station.id), title: station.name }));
        const stops: Option[] = allStops
            ? searchThroughStops(allStops, text).map(({ attributes }) => ({
                  kind: 'stop',
                  stopId: attributes.stopId,
                  title: attributes.title,
                  type: attributes.type,
              }))
            : [];
        const found: Option[] = places.slice(0, MAX_PLACES).map((place) => ({
            kind: 'place',
            stopId: pointValue(place),
            title: place.title,
            subtitle: place.subtitle || 'Адрес',
        }));
        return [...[...metro, ...stops].slice(0, MAX_RESULTS - found.length), ...found];
    }, [allStops, metroStations, query, places]);

    // Подсказки под полем выезжают при появлении, строки - лесенкой.
    const resultsRef = useRef<HTMLUListElement>(null);
    useReveal(resultsRef, results.length > 0, { items: 'li' });

    const subtitle = (option: Option) => {
        if (option.kind === 'metro') return 'Станция метро';
        if (option.kind === 'place') return option.subtitle;
        return directionLabel(directions?.get(option.stopId));
    };

    const choose = (option: Option) =>
        onChange(option.stopId, option.kind === 'place' ? option.title : undefined);

    const optionIcon = (option: Option) => {
        if (option.kind === 'metro') return <MetroIcon />;
        if (option.kind === 'place')
            return (
                <IconMapPin
                    size={24}
                    stroke={1.75}
                    className={cn(styles.JourneyStopIcon, styles.JourneyPlaceIcon)}
                    aria-hidden="true"
                />
            );
        return (
            <TransportIcon
                type={option.type}
                variant="stop"
                className={cn(styles.JourneyStopIcon)}
            />
        );
    };

    // Пока не начали вводить - быстрые варианты: где я и точка на карте.
    const showQuick = editing && query.trim().length < 2;

    if (!editing && selected) {
        return (
            <div className={cn(styles.JourneyField)}>
                <span
                    className={cn(styles.JourneyFieldMarker, `JourneyFieldMarker_${marker}`)}
                    aria-hidden="true"
                >
                    {marker}
                </span>
                <button
                    type="button"
                    className={cn(styles.JourneyFieldValue)}
                    onClick={() => setEditing(true)}
                    aria-label={`${label}: ${selected.title}. Изменить`}
                >
                    <span className={cn(styles.JourneyFieldTitle)}>{selected.title}</span>
                    {subtitle(selected) && (
                        <span className={cn(styles.JourneyNote)}>{subtitle(selected)}</span>
                    )}
                </button>
                <button
                    type="button"
                    className={cn(styles.JourneyIconButton)}
                    onClick={() => onChange(null)}
                    aria-label={`Очистить поле «${label}»`}
                    title="Очистить"
                >
                    <IconX size={18} stroke={2} aria-hidden="true" />
                </button>
            </div>
        );
    }

    return (
        <div className={cn(styles.JourneyField, styles.JourneyField_editing)}>
            <span
                className={cn(styles.JourneyFieldMarker, `JourneyFieldMarker_${marker}`)}
                aria-hidden="true"
            >
                {marker}
            </span>
            <input
                ref={inputRef}
                className={cn(styles.JourneyFieldInput, {
                    JourneyFieldInput_typing: typing !== null,
                })}
                type="search"
                placeholder={`${label}: ${typing ?? TYPING_HINT}`}
                aria-label={label}
                aria-controls={listId}
                aria-expanded={results.length > 0 || placeStatus !== 'idle'}
                role="combobox"
                aria-autocomplete="list"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape' && value) setEditing(false);
                    if (event.key === 'Enter' && results[0]) choose(results[0]);
                }}
            />
            {value && (
                <button
                    type="button"
                    className={cn(styles.JourneyIconButton)}
                    onClick={() => setEditing(false)}
                    aria-label="Отменить изменение"
                    title="Отменить"
                >
                    <IconX size={18} stroke={2} aria-hidden="true" />
                </button>
            )}
            {results.length > 0 && (
                <ul
                    ref={resultsRef}
                    id={listId}
                    role="listbox"
                    className={cn(styles.JourneyFieldResults)}
                >
                    {results.map((option) => (
                        <li key={option.stopId} role="option" aria-selected={false}>
                            <button
                                type="button"
                                className={cn(styles.JourneyFieldResult)}
                                onClick={() => choose(option)}
                            >
                                {optionIcon(option)}
                                <span className={cn(styles.JourneyFieldResultText)}>
                                    <span>{option.title}</span>
                                    <span className={cn(styles.JourneyNote)}>
                                        {subtitle(option)}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {placeStatus !== 'idle' && (
                <p className={cn(styles.JourneyPlaceStatus)} role="status">
                    {placeStatus === 'searching' && (
                        <>
                            <span className={cn(styles.JourneySpinner)} aria-hidden="true" />
                            Ищем адреса…
                        </>
                    )}
                    {placeStatus === 'done' &&
                        !places.length &&
                        (results.length
                            ? 'Адресов с таким названием нет — только остановки выше.'
                            : 'Адрес не найден. Попробуйте улицу и номер дома, например «Ленина 24».')}
                    {placeStatus === 'error' &&
                        'Поиск адресов сейчас недоступен — выберите остановку или точку на карте.'}
                </p>
            )}
            {showQuick && (
                <div className={cn(styles.JourneyQuick)}>
                    <button
                        type="button"
                        className={cn(styles.JourneyQuickButton)}
                        onClick={() => location.locate((point) => onChange(point, MY_LOCATION))}
                        disabled={location.status === 'locating'}
                    >
                        <IconMapPin size={18} stroke={2} aria-hidden="true" />
                        <span>
                            {location.status === 'locating' ? 'Определяем, где вы…' : MY_LOCATION}
                        </span>
                    </button>
                    <button
                        type="button"
                        className={cn(styles.JourneyQuickButton, {
                            JourneyQuickButton_active: isPicking,
                        })}
                        onClick={() => journeyActions.startPicking(field)}
                        aria-pressed={isPicking}
                    >
                        <IconClick size={18} stroke={2} aria-hidden="true" />
                        <span>
                            {isPicking ? 'Нажмите на карту… (отменить)' : 'Указать на карте'}
                        </span>
                    </button>
                    {location.status === 'denied' && (
                        <p className={cn(styles.JourneyNote)}>
                            Местоположение недоступно — найдите адрес или остановку поиском.
                        </p>
                    )}
                    {location.status === 'far' && (
                        <p className={cn(styles.JourneyNote)}>
                            Вы сейчас не в Краснодаре — найдите адрес или остановку поиском.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
