import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { waapi } from 'animejs';
import classNames from 'classnames/bind';
import {
    IconArrowLeft,
    IconChevronLeft,
    IconChevronRight,
    IconFlag,
    IconWalk,
} from '@tabler/icons-react';

import { journeyActions, useJourney } from 'services/journey/journeyStore';
import { isMetroStop } from 'services/journey/planner';
import { formatClock, minutesOfDay, PlannedJourney } from 'services/journey/schedule';
import { navigationSteps } from 'services/journey/steps';
import { prefersReducedMotion } from 'utils/reducedMotion';

import { JourneyMetroCars } from './JourneyMetroCars';
import { journeyLegColor, JourneyRouteChip } from './JourneyRouteChip';
import {
    entranceOf,
    formatDuration,
    formatMeters,
    metroCarHint,
    RideLeg,
    SOURCE_NOTE,
    stopsWord,
    TYPE_NOMINATIVE,
    walkText,
    WalkLeg,
} from './journeyText';

import styles from './JourneyNavigator.module.css';

const cn = classNames.bind(styles);

/** Минут от полуночи сейчас; обновляется раз в 20 секунд - для «через N мин». */
function useNowMinutes() {
    const [now, setNow] = useState(() => minutesOfDay(new Date()));
    useEffect(() => {
        const timer = setInterval(() => setNow(minutesOfDay(new Date())), 20 * 1000);
        return () => clearInterval(timer);
    }, []);
    return now;
}

function countdown(departure: number, now: number) {
    const left = Math.round(departure - now);
    if (left < -1) return { text: 'уже ушёл по расписанию', late: true };
    if (left <= 0) return { text: 'отправляется сейчас', late: false };
    return { text: `через ${formatDuration(left)}`, late: false };
}

interface NavigatorProps {
    journey: PlannedJourney;
    nameOf: (id: number) => string;
    toName: string;
}

function WalkStep({
    leg,
    isFirst,
    isLast,
    nameOf,
    next,
}: {
    leg: WalkLeg;
    isFirst: boolean;
    isLast: boolean;
    nameOf: (id: number) => string;
    next?: RideLeg;
}) {
    const { graph } = useJourney();

    return (
        <>
            <div className={cn(styles.NavStepHead)}>
                <span className={cn(styles.NavStepIcon)}>
                    <IconWalk size={26} stroke={2} aria-hidden="true" />
                </span>
                <h3 className={cn(styles.NavStepTitle)}>
                    {walkText(leg, isFirst, isLast, nameOf, entranceOf(graph, leg))}
                </h3>
            </div>
            <dl className={cn(styles.NavFacts)}>
                <div>
                    <dt>Пешком</dt>
                    <dd>
                        {formatMeters(leg.meters)} · ≈ {formatDuration(leg.minutes)}
                    </dd>
                </div>
                <div>
                    <dt>Время</dt>
                    <dd>
                        {formatClock(leg.start)} – {formatClock(leg.end)}
                    </dd>
                </div>
            </dl>
            {isMetroStop(leg.to) && (
                <p className={cn(styles.NavHint)}>
                    Вход, спуск и проход к платформе уже учтены во времени шага.
                </p>
            )}
            {next && !next.noService && (
                <p className={cn(styles.NavHint)}>
                    Дальше: {TYPE_NOMINATIVE[next.chosen.type].toLowerCase()}{' '}
                    {next.chosen.type === 'metro' ? '' : `№ ${next.chosen.number} `}в{' '}
                    {formatClock(next.departure)}
                </p>
            )}
        </>
    );
}

function RideStep({
    leg,
    nameOf,
    carHint,
}: {
    leg: RideLeg;
    nameOf: (id: number) => string;
    carHint: ReturnType<typeof metroCarHint>;
}) {
    const now = useNowMinutes();
    const stops = leg.chosen.stops.slice(leg.chosenBoardIndex, leg.chosenAlightIndex + 1);
    const count = stops.length - 1;
    const others = leg.alternatives.filter((option) => option.pattern !== leg.chosen);
    const left = countdown(leg.departure, now);
    const isMetro = leg.chosen.type === 'metro';

    return (
        <>
            <div className={cn(styles.NavStepHead)}>
                <JourneyRouteChip type={leg.chosen.type} num={leg.chosen.number} size="s" />
                <h3 className={cn(styles.NavStepTitle)}>
                    {TYPE_NOMINATIVE[leg.chosen.type]} в сторону «{leg.chosen.directionTo}»
                </h3>
            </div>

            <dl className={cn(styles.NavFacts)}>
                <div>
                    <dt>{isMetro ? 'Посадка на станции' : 'Посадка'}</dt>
                    <dd>«{nameOf(leg.from)}»</dd>
                </div>
                <div>
                    <dt>Отправление</dt>
                    {leg.noService ? (
                        <dd className={cn(styles.NavWarning)}>
                            Сегодня рейсов в эту сторону больше нет
                        </dd>
                    ) : (
                        <dd>
                            {formatClock(leg.departure)} ·{' '}
                            <span className={cn({ [styles.NavWarning]: left.late })}>
                                {left.text}
                            </span>
                            <span className={cn(styles.NavNote)}> · {SOURCE_NOTE[leg.source]}</span>
                        </dd>
                    )}
                </div>
                <div>
                    <dt>Выход</dt>
                    <dd>
                        «{nameOf(leg.to)}» — через {count} {stopsWord(leg, count)}, около{' '}
                        {formatClock(leg.arrival)}
                    </dd>
                </div>
            </dl>

            {carHint && <JourneyMetroCars hint={carHint} />}

            {others.length > 0 && (
                <p className={cn(styles.NavAlternatives)}>
                    <span className={cn(styles.NavNote)}>
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
                </p>
            )}

            <ol className={cn(styles.NavStops)} aria-label={isMetro ? 'Станции' : 'Остановки'}>
                {stops.map((stopId, index) => {
                    const edge = index === 0 || index === stops.length - 1;
                    return (
                        <li
                            key={`${stopId}-${index}`}
                            className={cn(styles.NavStop, { NavStop_edge: edge })}
                        >
                            <span>{nameOf(stopId)}</span>
                            {index === 0 && <span className={cn(styles.NavNote)}>посадка</span>}
                            {index === stops.length - 1 && (
                                <span className={cn(styles.NavNote)}>выходите</span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </>
    );
}

// Конфетти на финише: куда разлетается каждая бумажка, как повернётся, с какой задержкой и
// какого цвета. Цвета - транспорта и точки B.
const CONFETTI_COLORS = ['#00B400', '#FF640F', '#00B4FF', '#d32f2f', '#FFC107', '#9747FF'];
const CONFETTI = Array.from({ length: 14 }, (_, index) => {
    const angle = (index / 14) * Math.PI * 2 + (index % 2 ? 0.2 : -0.2);
    const distance = 46 + (index % 3) * 14;
    return {
        x: `${Math.round(Math.cos(angle) * distance)}px`,
        // Бумажки чуть опускаются к концу - как падают.
        y: `${Math.round(Math.sin(angle) * distance + 8)}px`,
        rotate: `${((index * 67) % 360) + 180}deg`,
        delay: (index % 4) * 30,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    };
});

/** Последний шаг - «вы на месте»: куда приехали и итог поездки. */
function FinishStep({ journey, toName }: { journey: PlannedJourney; toName: string }) {
    const walkMeters = journey.legs.reduce(
        (sum, item) => (item.kind === 'walk' ? sum + item.meters : sum),
        0,
    );
    const rides = journey.legs.filter((item): item is RideLeg => item.kind === 'ride');

    // Флаг «выпрыгивает», из него разлетается немного конфетти (anime.js, waapi): у каждой
    // бумажки свой угол, дальность и поворот (CONFETTI). С «уменьшить движение» - без них.
    const badgeRef = useRef<HTMLSpanElement>(null);
    useLayoutEffect(() => {
        const badge = badgeRef.current;
        if (!badge || prefersReducedMotion()) return undefined;
        const pieces = Array.from(badge.querySelectorAll<HTMLElement>('i'));
        const pop = waapi.animate(badge, {
            opacity: [0, 1],
            scale: [0.4, 1],
            duration: 500,
            delay: 100,
            ease: 'outBack(1.8)',
        });
        const burst = waapi.animate(pieces, {
            translateX: (_target, index) => ['0px', CONFETTI[index].x],
            translateY: (_target, index) => ['0px', CONFETTI[index].y],
            rotate: (_target, index) => ['0deg', CONFETTI[index].rotate],
            scale: [0.6, 1],
            opacity: [1, 1, 0],
            duration: 1100,
            delay: (_target, index) => 350 + CONFETTI[index].delay,
            ease: 'out(3)',
        });
        return () => {
            pop.revert();
            burst.revert();
        };
    }, []);

    return (
        <div className={cn(styles.NavFinish)}>
            <span ref={badgeRef} className={cn(styles.NavFinishBadge)} aria-hidden="true">
                <IconFlag size={30} stroke={2} />
                {/* Немного конфетти - анимация в эффекте выше. */}
                <span className={cn(styles.NavConfetti)}>
                    {CONFETTI.map((piece, index) => (
                        <i key={index} style={{ background: piece.color }} />
                    ))}
                </span>
            </span>
            <span className={cn(styles.NavFinishLabel)}>Вы на месте</span>
            <h3 className={cn(styles.NavFinishTitle)}>«{toName}»</h3>

            {rides.length > 0 && (
                <span className={cn(styles.NavFinishRides)}>
                    <span className={cn(styles.NavFinishRidesLabel)}>Катались на</span>
                    {rides.map((ride, index) => (
                        <React.Fragment key={index}>
                            {index > 0 && (
                                <IconChevronRight size={14} stroke={2} aria-hidden="true" />
                            )}
                            <JourneyRouteChip
                                type={ride.chosen.type}
                                num={ride.chosen.number}
                                size="xs"
                            />
                        </React.Fragment>
                    ))}
                </span>
            )}

            <dl className={cn(styles.NavFinishFacts)}>
                {!journey.noServiceToday && (
                    <div>
                        <dt>Прибытие</dt>
                        <dd>≈ {formatClock(journey.arrival)}</dd>
                    </div>
                )}
                {!journey.noServiceToday && (
                    <div>
                        <dt>В пути</dt>
                        <dd>{formatDuration(journey.arrival - journey.start)}</dd>
                    </div>
                )}
                <div>
                    <dt>Пешком</dt>
                    <dd>{formatMeters(walkMeters)}</dd>
                </div>
            </dl>
        </div>
    );
}

/**
 * Навигатор по шагам выбранного варианта («Поехали»): по одному этапу на экран с подробностями,
 * листается кнопками, стрелками клавиатуры и свайпом. Карта (MapJourneyLayer) показывает
 * крупно текущий этап.
 */
export function JourneyNavigator({ journey, nameOf, toName }: NavigatorProps) {
    const { navStep, graph } = useJourney();
    const steps = navigationSteps(journey);
    const current = Math.min(navStep ?? 0, steps.length - 1);
    const legIndex = steps[current];
    const cardRef = useRef<HTMLElement>(null);
    // Новый шаг въезжает сбоку - с той стороны, куда листали (anime.js, waapi). Только при
    // смене шага: не на первом показе и не на посторонней перерисовке.
    const previousStep = useRef(current);
    useLayoutEffect(() => {
        const card = cardRef.current;
        const from = previousStep.current;
        previousStep.current = current;
        if (!card || from === current || prefersReducedMotion()) return undefined;
        const animation = waapi.animate(card, {
            opacity: [0, 1],
            translateX: [`${current > from ? 24 : -24}px`, '0px'],
            duration: 320,
            ease: 'out(3)',
        });
        return () => {
            animation.revert();
        };
    }, [current]);
    const touchStart = useRef<{ x: number; y: number } | null>(null);

    const go = (step: number) => {
        if (step < 0 || step >= steps.length) return;
        journeyActions.setNavStep(step);
    };

    // Новый шаг - панель к началу: видно, какой это шаг, и карточку с первой строки.
    // (scrollIntoView карточки на телефоне прокручивал шторку так, что заголовок с номером
    // шага и «К вариантам» уезжал за верх.)
    useEffect(() => {
        cardRef.current?.closest('#Sidepage-scroll-container')?.scrollTo({ top: 0 });
    }, [current]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
            if (event.key === 'ArrowRight') go(current + 1);
            else if (event.key === 'ArrowLeft') go(current - 1);
            else if (event.key === 'Escape') journeyActions.stopNavigation();
            else return;
            // Клавиша занята навигатором - общие горячие клавиши (MapHotkeys) её пропускают:
            // Esc выходит из навигатора, а не закрывает всю панель.
            event.preventDefault();
        };
        // Фаза перехвата - чтобы сработать раньше общих горячих клавиш на том же window.
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    });

    const leg = legIndex === null ? null : journey.legs[legIndex];
    const visible = steps.filter((step): step is number => step !== null);
    const nextRide = (() => {
        if (legIndex === null) return undefined;
        const after = journey.legs.slice(legIndex + 1).find((item) => item.kind === 'ride');
        return after?.kind === 'ride' ? after : undefined;
    })();

    return (
        <div className={cn(styles.Nav)}>
            <div className={cn(styles.NavTop)}>
                <button
                    type="button"
                    className={cn(styles.NavBack)}
                    onClick={journeyActions.stopNavigation}
                >
                    <IconArrowLeft size={18} stroke={2} aria-hidden="true" />К вариантам
                </button>
                <span className={cn(styles.NavCounter)} aria-live="polite">
                    Шаг {current + 1} из {steps.length}
                </span>
            </div>

            <div className={cn(styles.NavDots)} role="tablist" aria-label="Шаги маршрута">
                {steps.map((step, index) => (
                    <button
                        key={index}
                        type="button"
                        role="tab"
                        aria-selected={index === current}
                        aria-label={`Шаг ${index + 1}`}
                        className={cn(styles.NavDot, { NavDot_active: index === current })}
                        onClick={() => go(index)}
                    />
                ))}
            </div>

            <section
                ref={cardRef}
                key={current}
                className={cn(styles.NavCard)}
                aria-roledescription="шаг маршрута"
                onTouchStart={(event) => {
                    const touch = event.touches[0];
                    touchStart.current = { x: touch.clientX, y: touch.clientY };
                }}
                onTouchEnd={(event) => {
                    const start = touchStart.current;
                    touchStart.current = null;
                    if (!start) return;
                    const touch = event.changedTouches[0];
                    const dx = touch.clientX - start.x;
                    const dy = touch.clientY - start.y;
                    // Только уверенный горизонтальный свайп - вертикальный листает список остановок.
                    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                        go(current + (dx < 0 ? 1 : -1));
                    }
                }}
            >
                {leg?.kind === 'walk' && (
                    <WalkStep
                        leg={leg}
                        isFirst={legIndex === visible[0]}
                        isLast={legIndex === visible[visible.length - 1]}
                        nameOf={nameOf}
                        next={nextRide}
                    />
                )}
                {leg?.kind === 'ride' && legIndex !== null && (
                    <RideStep
                        leg={leg}
                        nameOf={nameOf}
                        carHint={metroCarHint(graph, journey.legs, legIndex)}
                    />
                )}
                {leg === null && <FinishStep journey={journey} toName={toName} />}
            </section>

            <div
                className={cn(styles.NavControls)}
                style={{ '--NavAccent': journeyLegColor(graph, leg) } as React.CSSProperties}
            >
                <button
                    type="button"
                    className={cn(styles.NavButton)}
                    onClick={() => go(current - 1)}
                    disabled={current === 0}
                >
                    <IconChevronLeft size={20} stroke={2} aria-hidden="true" />
                    Назад
                </button>
                {current < steps.length - 1 ? (
                    <button
                        type="button"
                        className={cn(styles.NavButton, styles.NavButton_primary)}
                        onClick={() => go(current + 1)}
                    >
                        Дальше
                        <IconChevronRight size={20} stroke={2} aria-hidden="true" />
                    </button>
                ) : (
                    <button
                        type="button"
                        className={cn(styles.NavButton, styles.NavButton_primary)}
                        onClick={journeyActions.stopNavigation}
                    >
                        Готово
                    </button>
                )}
            </div>
        </div>
    );
}
