import React, { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { useSelector } from 'react-redux';
import {
    IconArrowsUpDown,
    IconChevronRight,
    IconPlayerPlayFilled,
    IconRefresh,
    IconWalk,
} from '@tabler/icons-react';

import { State } from 'common/types/state';
import { Typography } from 'components/UI/Typography/Typography';
import { Divider } from 'components/UI/Divider/Divider';
import { ShareButton, shareOrigin } from 'components/UI/ShareButton/ShareButton';
import { useStopDirections } from 'hooks/useStopDirections';
import {
    getJourneyState,
    journeyActions,
    loadJourneyGraph,
    placeLabel,
    useJourney,
} from 'services/journey/journeyStore';
import { isPointValue } from 'services/journey/places';
import { MIN_WALK_TO_SHOW_M, visibleLegIndices } from 'services/journey/steps';
import { DESTINATION_ID, Graph, isMetroStop, ORIGIN_ID } from 'services/journey/planner';
import { formatClock, minutesOfDay, PlannedJourney } from 'services/journey/schedule';

import { JourneyMetroCars } from './JourneyMetroCars';
import { JourneyNavigator } from './JourneyNavigator';
import { journeyAccentColor, JourneyRouteChip } from './JourneyRouteChip';
import { JourneyStopField } from './JourneyStopField';
import {
    entranceOf,
    formatDuration,
    formatMeters,
    metroCarHint,
    plural,
    RideLeg,
    SOURCE_NOTE,
    stopsWord,
    walkText,
} from './journeyText';

import pill from 'components/UI/PillButton/PillButton.module.css';
import styles from './MapJourneySidebar.module.css';

const cn = classNames.bind(styles);

const visibleLegs = (journey: PlannedJourney) =>
    visibleLegIndices(journey).map((index) => journey.legs[index]);

const walkMetersOf = (journey: PlannedJourney) =>
    journey.legs.reduce((sum, leg) => (leg.kind === 'walk' ? sum + leg.meters : sum), 0);

function JourneyChips({ journey }: { journey: PlannedJourney }) {
    const legs = visibleLegs(journey);

    return (
        <span className={cn(styles.JourneyChips)}>
            {legs.map((leg, index) => (
                <React.Fragment key={index}>
                    {index > 0 && (
                        <IconChevronRight
                            size={14}
                            stroke={2}
                            className={cn(styles.JourneyChevron)}
                            aria-hidden="true"
                        />
                    )}
                    {leg.kind === 'walk' ? (
                        <span
                            className={cn(styles.JourneyWalkChip)}
                            title={`Пешком ${formatMeters(leg.meters)}`}
                        >
                            <IconWalk size={18} stroke={2} aria-hidden="true" />
                        </span>
                    ) : (
                        <span className={cn(styles.JourneyRideChip)}>
                            <JourneyRouteChip
                                type={leg.chosen.type}
                                num={leg.chosen.number}
                                size="xs"
                            />
                            {leg.alternatives.length > 1 && (
                                <span className={cn(styles.JourneyNote)}>
                                    +{leg.alternatives.length - 1}
                                </span>
                            )}
                        </span>
                    )}
                </React.Fragment>
            ))}
        </span>
    );
}

function JourneySteps({
    journey,
    names,
    toName,
}: {
    journey: PlannedJourney;
    names: Map<string, string>;
    toName: string;
}) {
    const indices = visibleLegIndices(journey);
    const legs = indices.map((index) => journey.legs[index]);
    const nameOf = (id: number) => names.get(String(id)) ?? '';
    const { graph } = useJourney();

    return (
        <ol className={cn(styles.JourneySteps)}>
            {legs.map((leg, index) => {
                if (leg.kind === 'walk') {
                    const isLast = index === legs.length - 1;
                    return (
                        <li key={index} className={cn(styles.JourneyStep, styles.JourneyStep_walk)}>
                            <span className={cn(styles.JourneyStepRail)}>
                                <IconWalk
                                    size={20}
                                    stroke={2}
                                    className={cn(styles.JourneyStepIcon)}
                                    aria-hidden="true"
                                />
                            </span>
                            <span className={cn(styles.JourneyStepBody)}>
                                <span>
                                    {walkText(
                                        leg,
                                        index === 0,
                                        isLast,
                                        nameOf,
                                        entranceOf(graph, leg),
                                    )}
                                </span>
                                <span className={cn(styles.JourneyNote)}>
                                    ≈ {formatDuration(leg.minutes)}
                                </span>
                            </span>
                        </li>
                    );
                }

                const stopsCount = leg.chosenAlightIndex - leg.chosenBoardIndex;
                const others = leg.alternatives.filter((option) => option.pattern !== leg.chosen);
                const wait = leg.departure - leg.ready;
                const carHint = metroCarHint(graph, journey.legs, indices[index]);

                return (
                    <li key={index} className={cn(styles.JourneyStep)}>
                        <span className={cn(styles.JourneyStepRail)}>
                            <JourneyRouteChip
                                type={leg.chosen.type}
                                num={leg.chosen.number}
                                size="xs"
                            />
                        </span>
                        <span className={cn(styles.JourneyStepBody)}>
                            <span className={cn(styles.JourneyStepStops)}>
                                «{nameOf(leg.from)}» → «{nameOf(leg.to)}»
                            </span>
                            <span className={cn(styles.JourneyNote)}>
                                в сторону «{leg.chosen.directionTo}» · {stopsCount}{' '}
                                {stopsWord(leg, stopsCount)} · ≈{' '}
                                {formatDuration(leg.arrival - leg.departure)}
                            </span>
                            {leg.noService ? (
                                <span className={cn(styles.JourneyWarning)}>
                                    Сегодня рейсов в эту сторону больше нет
                                </span>
                            ) : (
                                <span className={cn(styles.JourneyNote)}>
                                    Отправление в {formatClock(leg.departure)}
                                    {wait >= 1 ? `, ждать ${formatDuration(wait)}` : ''} ·{' '}
                                    {SOURCE_NOTE[leg.source]}
                                </span>
                            )}
                            {carHint && <JourneyMetroCars hint={carHint} />}
                            {others.length > 0 && (
                                <span className={cn(styles.JourneyAlternatives)}>
                                    <span className={cn(styles.JourneyNote)}>
                                        {others.length === 1 ? 'Подойдёт и' : 'Подойдут и'}
                                    </span>
                                    {others.map(({ pattern }) => (
                                        <JourneyRouteChip
                                            key={`${pattern.type}-${pattern.number}`}
                                            type={pattern.type}
                                            num={pattern.number}
                                            size="xs"
                                        />
                                    ))}
                                </span>
                            )}
                        </span>
                    </li>
                );
            })}
            <li className={cn(styles.JourneyStep, styles.JourneyStep_finish)}>
                <span className={cn(styles.JourneyStepRail)}>
                    <span
                        className={cn(styles.JourneyFieldMarker, styles.JourneyFieldMarker_B)}
                        aria-hidden="true"
                    >
                        B
                    </span>
                </span>
                <span className={cn(styles.JourneyStepBody)}>
                    <span>
                        {journey.noServiceToday
                            ? `«${toName}»`
                            : `«${toName}» около ${formatClock(journey.arrival)}`}
                    </span>
                </span>
            </li>
        </ol>
    );
}

function JourneyOption({
    journey,
    selected,
    onSelect,
    names,
    toName,
}: {
    journey: PlannedJourney;
    selected: boolean;
    onSelect: () => void;
    names: Map<string, string>;
    toName: string;
}) {
    const transfers = journey.itinerary.rides - 1;
    const walk = walkMetersOf(journey);
    const firstRide = journey.legs.find((leg): leg is RideLeg => leg.kind === 'ride');
    const { graph } = useJourney();

    return (
        <li className={cn(styles.JourneyOption, { JourneyOption_selected: selected })}>
            <button
                type="button"
                className={cn(styles.JourneyOptionButton)}
                onClick={onSelect}
                aria-expanded={selected}
            >
                <span className={cn(styles.JourneyOptionTop)}>
                    <span className={cn(styles.JourneyOptionDuration)}>
                        {journey.noServiceToday
                            ? `≈ ${formatDuration(journey.itinerary.estimatedMinutes)}`
                            : formatDuration(journey.arrival - journey.start)}
                    </span>
                    {!journey.noServiceToday && (
                        <span className={cn(styles.JourneyOptionClock)}>
                            {formatClock(journey.start)} – {formatClock(journey.arrival)}
                        </span>
                    )}
                </span>
                <JourneyChips journey={journey} />
                <span className={cn(styles.JourneyNote)}>
                    {transfers < 0 && `Пешком ${formatMeters(walk)}, без транспорта`}
                    {transfers === 0 && 'Без пересадок'}
                    {transfers > 0 &&
                        `${transfers} ${plural(transfers, 'пересадка', 'пересадки', 'пересадок')}`}
                    {transfers >= 0 && walk >= MIN_WALK_TO_SHOW_M
                        ? ` · пешком ${formatMeters(walk)}`
                        : ''}
                    {firstRide && !journey.noServiceToday
                        ? ` · отправление в ${formatClock(firstRide.departure)}`
                        : ''}
                </span>
                {journey.noServiceToday && (
                    <span className={cn(styles.JourneyWarning)}>
                        Сегодня по этому варианту рейсов уже нет
                    </span>
                )}
            </button>
            {selected && (
                <>
                    <JourneySteps journey={journey} names={names} toName={toName} />
                    <div className={cn(styles.JourneyGoRow)}>
                        <button
                            type="button"
                            className={cn(styles.JourneyGo)}
                            style={{ backgroundColor: journeyAccentColor(graph, journey) }}
                            onClick={journeyActions.startNavigation}
                        >
                            <IconPlayerPlayFilled size={18} aria-hidden="true" />
                            Поехали
                        </button>
                    </div>
                </>
            )}
        </li>
    );
}

/**
 * Маршрут от места или остановки: пересадок - сколько разрешено в настройках, с пешими переходами между соседними
 * остановками. Поиск - services/journey/planner.ts, отправления по расписанию -
 * services/journey/schedule.ts, линия на карте - MapJourneyLayer.
 */
export function MapJourneySidebar() {
    const journey = useJourney();
    const allStops = useSelector((state: State) => state.publicTransport.stops);
    const directions = useStopDirections();

    useEffect(() => {
        journeyActions.setPanelOpen(true);
        return () => journeyActions.setPanelOpen(false);
    }, []);

    // Отправления посчитаны на момент поиска - если панель висит открытой, пересчитываем.
    useEffect(() => {
        if (journey.status !== 'done') return undefined;
        // Во время навигации вариант не пересчитываем: пересортировка подменила бы маршрут на ходу.
        const timer = setInterval(() => {
            if (getJourneyState().navStep === null) journeyActions.refresh();
        }, 60 * 1000);
        return () => clearInterval(timer);
    }, [journey.status, journey.from, journey.to]);

    // Станции метро есть только в графе поиска (с отрицательными id), не в списке остановок.
    const [graph, setGraph] = useState<Graph | null>(null);
    useEffect(() => {
        loadJourneyGraph()
            .then(setGraph)
            .catch(() => undefined);
    }, []);

    const names = useMemo(() => {
        const result = new Map(
            (allStops ?? []).map(({ attributes }) => [attributes.stopId, attributes.title]),
        );
        graph?.stops.forEach((stop) => {
            if (isMetroStop(stop.id)) result.set(String(stop.id), stop.name);
        });
        // Места «откуда/куда» в шагах маршрута - под своими виртуальными id.
        [
            [ORIGIN_ID, journey.from],
            [DESTINATION_ID, journey.to],
        ].forEach(([id, value]) => {
            if (isPointValue(value as string | null))
                result.set(String(id), placeLabel(value as string, journey.labels));
        });
        return result;
    }, [allStops, graph, journey.from, journey.to, journey.labels]);
    const fromName =
        (journey.from &&
            (isPointValue(journey.from)
                ? names.get(String(ORIGIN_ID))
                : names.get(journey.from))) ||
        '';
    const toName =
        (journey.to &&
            (isPointValue(journey.to)
                ? names.get(String(DESTINATION_ID))
                : names.get(journey.to))) ||
        '';

    const shareUrl = useMemo(() => {
        if (typeof window === 'undefined' || !journey.from || !journey.to) return '';
        // Посредник для превью в Telegram (см. SHARE_URL), в разработке - сам сайт.
        const url = new URL('/map', shareOrigin());
        url.searchParams.set('from', journey.from);
        url.searchParams.set('to', journey.to);
        // Подпись места уходит в ссылку, кроме «Моё местоположение» - у получателя оно своё.
        (['from', 'to'] as const).forEach((field) => {
            const value = journey[field];
            const label = value && isPointValue(value) ? journey.labels[value] : undefined;
            if (label && label !== 'Моё местоположение')
                url.searchParams.set(`${field}Name`, label);
        });
        return url.toString();
    }, [journey.from, journey.to, journey.labels]);

    const plannedAgo =
        journey.plannedAt !== null
            ? minutesOfDay(new Date()) - minutesOfDay(new Date(journey.plannedAt))
            : 0;

    const navigating =
        journey.navStep !== null && journey.status === 'done' && journey.journeys[journey.selected];

    if (navigating) {
        return (
            <div className={cn(styles.MapJourney)}>
                <div className={cn(styles.MapJourneyHeader, styles.MapJourneyHeader_nav)}>
                    <Typography variant="h4">В пути</Typography>
                    <p className={cn(styles.JourneyNote)}>
                        {fromName} → {toName}
                    </p>
                </div>
                <JourneyNavigator
                    journey={journey.journeys[journey.selected]}
                    nameOf={(id) =>
                        names.get(String(id)) ?? journey.graph?.stops.get(id)?.name ?? ''
                    }
                    toName={toName}
                />
            </div>
        );
    }

    return (
        <div className={cn(styles.MapJourney)}>
            <div className={cn(styles.MapJourneyHeader)}>
                <Typography variant="h4">Маршрут</Typography>
            </div>

            <div className={cn(styles.JourneyFields)}>
                <div className={cn(styles.JourneyFieldsColumn)}>
                    <JourneyStopField
                        label="Откуда"
                        marker="A"
                        field="from"
                        value={journey.from}
                        onChange={journeyActions.setFrom}
                        directions={directions}
                        autoFocus={!journey.from}
                    />
                    <JourneyStopField
                        label="Куда"
                        marker="B"
                        field="to"
                        value={journey.to}
                        onChange={journeyActions.setTo}
                        directions={directions}
                        autoFocus={Boolean(journey.from) && !journey.to}
                    />
                </div>
                <button
                    type="button"
                    className={cn(styles.JourneyIconButton, styles.JourneySwap)}
                    onClick={journeyActions.swap}
                    disabled={!journey.from && !journey.to}
                    aria-label="Поменять местами «Откуда» и «Куда»"
                    title="Поменять местами"
                >
                    <IconArrowsUpDown size={20} stroke={2} aria-hidden="true" />
                </button>
            </div>

            <Divider />

            <div aria-live="polite">
                {journey.status === 'idle' && journey.from && journey.from === journey.to && (
                    <p className={cn(styles.JourneyNote, styles.JourneyPadded)}>
                        Откуда и куда — одно и то же место.
                    </p>
                )}
                {journey.status === 'loading' && (
                    <p className={cn(styles.JourneyNote, styles.JourneyPadded)}>Ищем варианты…</p>
                )}
                {journey.status === 'error' && (
                    <p className={cn(styles.JourneyNote, styles.JourneyPadded)}>
                        Не удалось загрузить данные о маршрутах. Попробуйте ещё раз чуть позже.
                    </p>
                )}
                {journey.status === 'done' && !journey.journeys.length && (
                    <p className={cn(styles.JourneyNote, styles.JourneyPadded)}>
                        {journey.maxTransfers === 0
                            ? 'Не нашли, как доехать без пересадок.'
                            : `Не нашли вариантов, где пересадок не больше ${journey.maxTransfers}.`}{' '}
                        Попробуйте соседнюю остановку или место
                        {journey.maxTransfers < 3
                            ? ' — или разрешите больше пересадок в настройках.'
                            : '.'}
                    </p>
                )}
            </div>

            {journey.status === 'done' && journey.journeys.length > 0 && (
                <>
                    <ul className={cn(styles.JourneyOptions)}>
                        {journey.journeys.map((item, index) => (
                            <JourneyOption
                                key={index}
                                journey={item}
                                selected={index === journey.selected}
                                onSelect={() => journeyActions.select(index)}
                                names={names}
                                toName={toName}
                            />
                        ))}
                    </ul>
                    <div className={cn(styles.JourneyFooter)}>
                        <p className={cn(styles.JourneyNote)}>
                            Время в пути примерное: пробки и задержки не учтены.
                            {plannedAgo >= 1
                                ? ` Посчитано ${Math.round(plannedAgo)} мин назад.`
                                : ''}
                        </p>
                        <div className={pill.PillButtonGrid}>
                            <ShareButton url={shareUrl} title="Маршрут на карте транспорта" />
                            <button
                                type="button"
                                className={pill.PillButton}
                                onClick={journeyActions.refresh}
                            >
                                <IconRefresh className={pill.PillButtonIcon} aria-hidden="true" />
                                <span>Обновить</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
