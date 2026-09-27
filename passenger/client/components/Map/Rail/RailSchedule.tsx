import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconExternalLink, IconPlaneArrival, IconPlaneDeparture } from '@tabler/icons-react';
import classNames from 'classnames/bind';

import { fetchRailSchedule, RailDeparture, RailStationNotFoundError } from 'api/ekb/collections';
import { NoServiceNotice } from 'components/Map/Schedule/NoServiceNotice';
import { STATION_KIND_COLORS } from 'components/UI/StationIcon/StationIcon';
import ChevronDown from 'public/icons/chevron-down.svg';

import controls from 'components/Map/Schedule/ScheduleControls.module.css';
import { RailStation } from './MapRail';
import styles from './RailSchedule.module.css';

const cn = classNames.bind({ ...controls, ...styles });
const TIME_ZONE = 'Europe/Moscow';

function dateKey(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value;
    return `${value('year')}-${value('month')}-${value('day')}`;
}

function makeDays() {
    const now = new Date();
    return Array.from({ length: 3 }, (_, index) => {
        const date = new Date(now.getTime() + index * 24 * 60 * 60 * 1000);
        const short = new Intl.DateTimeFormat('ru-RU', {
            timeZone: TIME_ZONE,
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        })
            .format(date)
            .replace('.', '');
        return { key: dateKey(date), label: index === 0 ? 'Сегодня' : short };
    });
}

function formatTime(value: string | null) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function departureLabel(item: RailDeparture) {
    const type =
        item.transportType === 'bus'
            ? 'Автобус'
            : item.transportType === 'plane'
              ? 'Рейс'
              : item.transportType === 'suburban'
                ? 'Электричка'
                : 'Поезд';
    return item.number ? `${type} ${item.number}` : type;
}

// Если один конец рейса - Краснодар (аэропорт, автовокзал, пригородные поезда), на табло
// он лишний: «Краснодар — Анталья» среди вылетов читается как «Анталья». Транзитные рейсы
// («Москва — Владивосток») не трогаем - там оба конца важны.
function tripTitle(title: string, event: 'departure' | 'arrival') {
    const parts = title.split(' — ');
    if (parts.length !== 2) return title;
    const [from, to] = parts;
    if (event === 'departure' && from.startsWith('Краснодар')) return to;
    if (event === 'arrival' && to.startsWith('Краснодар')) return from;
    return title;
}

// «через 25 мин» - только в пределах часа, дальше время на табло говорит само за себя.
function untilLabel(value: string | null) {
    if (!value) return null;
    const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
    if (minutes < 0 || minutes >= 60) return null;
    return minutes === 0 ? 'сейчас' : `через ${minutes} мин`;
}

function scheduleTransport(kind: RailStation['kind']) {
    return kind === 'bus_terminal' ? 'bus' : kind === 'airport' ? 'plane' : 'rail';
}

function vehiclesLabel(kind: RailStation['kind']) {
    return kind === 'bus_terminal' ? 'Автобусы' : kind === 'airport' ? 'Самолёты' : 'Поезда';
}

// Квадратные логотипы авиакомпаний по IATA-коду. Если логотипа нет, вместо картинки
// остаётся плашка с самим кодом - так строка табло не прыгает по ширине.
function AirlineLogo({ code, name }: { code: string; name: string }) {
    const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
    const imageRef = useRef<HTMLImageElement>(null);

    // Картинка из кэша браузера может загрузиться раньше, чем React навесит onLoad, -
    // тогда событие уже не придёт, и скелетон остался бы навсегда.
    useEffect(() => {
        const image = imageRef.current;
        if (image?.complete) setState(image.naturalWidth > 0 ? 'loaded' : 'failed');
    }, []);

    if (!code || state === 'failed') {
        return (
            <span className={styles.RailScheduleLogo} aria-hidden="true">
                {code || '✈'}
            </span>
        );
    }

    return (
        // Пока логотип грузится, на его месте пульсирует скелетон того же размера.
        <span
            className={cn(styles.RailScheduleLogo, {
                [styles.RailScheduleLogoLoading]: state === 'loading',
            })}
            aria-busy={state === 'loading'}
        >
            <img
                ref={imageRef}
                className={cn(styles.RailScheduleLogoImage, {
                    [styles.RailScheduleLogoImageLoaded]: state === 'loaded',
                })}
                src={`https://pics.avs.io/al_square/64/64/${encodeURIComponent(code)}.png`}
                alt={name}
                width={28}
                height={28}
                loading="lazy"
                onLoad={() => setState('loaded')}
                onError={() => setState('failed')}
            />
        </span>
    );
}

export function RailSchedule({ station }: { station: RailStation }) {
    const days = useMemo(makeDays, []);
    const [selectedDate, setSelectedDate] = useState(days[0].key);
    const [selectedEvent, setSelectedEvent] = useState<'departure' | 'arrival'>('departure');
    const [departures, setDepartures] = useState<RailDeparture[]>([]);
    const [source, setSource] = useState<{ title: string; url: string } | null>(null);
    const [hidePast, setHidePast] = useState(true);
    const [visibleCount, setVisibleCount] = useState(20);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [notFound, setNotFound] = useState(false);
    // Есть ли сегодня хоть один рейс - от этого зависит плашка "сегодня не ходит", которая,
    // как у остановок, висит над расписанием независимо от выбранного дня.
    const [hasServiceToday, setHasServiceToday] = useState<boolean | null>(null);
    const transport = scheduleTransport(station.kind);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setFailed(false);
        setNotFound(false);
        fetchRailSchedule(
            station.lat,
            station.lng,
            selectedDate,
            transport,
            selectedEvent,
            station.name,
        )
            .then((schedule) => {
                if (!active) return;
                setDepartures(schedule.departures);
                setSource(schedule.source);
            })
            .catch((error) => {
                if (!active) return;
                setDepartures([]);
                if (error instanceof RailStationNotFoundError) setNotFound(true);
                else setFailed(true);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [selectedDate, selectedEvent, station.lat, station.lng, station.name, transport]);

    useEffect(() => {
        let active = true;
        setHasServiceToday(null);
        // Запрос на сегодня попадает в кэш fetchRailSchedule, так что при открытой вкладке
        // "Сегодня" он не уходит в сеть второй раз.
        fetchRailSchedule(
            station.lat,
            station.lng,
            days[0].key,
            transport,
            'departure',
            station.name,
        )
            .then((schedule) => {
                if (active) setHasServiceToday(schedule.departures.length > 0);
            })
            .catch((error) => {
                if (active && error instanceof RailStationNotFoundError) setHasServiceToday(false);
            });
        return () => {
            active = false;
        };
    }, [days, station.lat, station.lng, station.name, transport]);

    useEffect(() => setVisibleCount(20), [hidePast, selectedDate, selectedEvent]);

    const isToday = selectedDate === days[0].key;
    const visibleDepartures = useMemo(
        () =>
            departures.filter((item) => {
                const time = selectedEvent === 'arrival' ? item.arrival : item.departure;
                return !hidePast || !isToday || !time || new Date(time).getTime() >= Date.now();
            }),
        [departures, hidePast, isToday, selectedEvent],
    );
    const displayedDepartures = visibleDepartures.slice(0, visibleCount);
    // Ближайший ещё не ушедший рейс сегодня - под его временем пишем, через сколько он.
    const nextIndex = isToday
        ? displayedDepartures.findIndex((item) => {
              const time = selectedEvent === 'arrival' ? item.arrival : item.departure;
              return time && new Date(time).getTime() >= Date.now();
          })
        : -1;

    const noServiceNotice = hasServiceToday === false && (
        <NoServiceNotice
            title={notFound ? 'Нет расписания' : 'Нет отправлений на сегодня'}
            text={
                notFound
                    ? 'Для этой станции расписание не публикуется'
                    : `${vehiclesLabel(station.kind)} сегодня не ходят или расписание не опубликовано`
            }
        />
    );

    // Станции нет в Яндекс Расписаниях - дни листать бессмысленно, оставляем одну плашку.
    if (notFound) {
        return <section className={styles.RailSchedule}>{noServiceNotice}</section>;
    }

    return (
        <section
            className={styles.RailSchedule}
            style={{ '--ScheduleAccent': STATION_KIND_COLORS[station.kind] } as React.CSSProperties}
        >
            {noServiceNotice}
            {station.kind === 'airport' && (
                <div className={controls.Segmented} role="group" aria-label="Тип табло">
                    {(['departure', 'arrival'] as const).map((event) => (
                        <button
                            type="button"
                            className={cn(controls.SegmentedItem, {
                                [controls.SegmentedItemActive]: selectedEvent === event,
                            })}
                            aria-pressed={selectedEvent === event}
                            onClick={() => setSelectedEvent(event)}
                            key={event}
                        >
                            {event === 'departure' ? (
                                <IconPlaneDeparture size={18} stroke={2} aria-hidden="true" />
                            ) : (
                                <IconPlaneArrival size={18} stroke={2} aria-hidden="true" />
                            )}
                            <span>{event === 'departure' ? 'Вылеты' : 'Прилёты'}</span>
                        </button>
                    ))}
                </div>
            )}
            <div className={controls.Tabs} aria-label="Выбор дня">
                {days.map((day) => (
                    <button
                        type="button"
                        className={cn(controls.Tab, {
                            [controls.TabActive]: selectedDate === day.key,
                        })}
                        onClick={() => setSelectedDate(day.key)}
                        key={day.key}
                    >
                        {day.label}
                    </button>
                ))}
            </div>

            {!loading && isToday && departures.length > 0 && (
                <button
                    type="button"
                    className={styles.RailScheduleFilter}
                    aria-expanded={!hidePast}
                    onClick={() => setHidePast(!hidePast)}
                >
                    <span>{hidePast ? 'Показать прошедшие' : 'Скрыть прошедшие'}</span>
                    <ChevronDown
                        className={cn(styles.RailScheduleFilterArrow, {
                            [styles.RailScheduleFilterArrowCollapsed]: hidePast,
                        })}
                    />
                </button>
            )}

            {loading ? (
                <div className={styles.RailScheduleLoading} aria-label="Загрузка расписания">
                    <span />
                    <span />
                    <span />
                </div>
            ) : failed ? (
                <NoServiceNotice
                    title="Нет данных о расписании"
                    text="Не удалось загрузить расписание. Попробуйте позже"
                />
            ) : departures.length === 0 ? (
                // Про сегодняшний день уже говорит плашка сверху - здесь не дублируем её.
                isToday && hasServiceToday === false ? null : (
                    <p className={styles.RailScheduleEmpty}>
                        {isToday ? 'Сегодня' : 'В этот день'}{' '}
                        {selectedEvent === 'arrival' ? 'прибытий' : 'отправлений'} нет
                    </p>
                )
            ) : visibleDepartures.length === 0 ? (
                <p className={styles.RailScheduleEmpty}>
                    Все {selectedEvent === 'arrival' ? 'прибытия' : 'отправления'} на сегодня уже
                    прошли
                </p>
            ) : (
                <div className={styles.RailScheduleList}>
                    {displayedDepartures.map((departure, index) => {
                        const time =
                            selectedEvent === 'arrival' ? departure.arrival : departure.departure;
                        const until = index === nextIndex ? untilLabel(time) : null;

                        return (
                            <article
                                className={cn(styles.RailScheduleItem, {
                                    [styles.RailScheduleItemWithLogo]: station.kind === 'airport',
                                })}
                                key={`${departure.number}-${departure.departure}-${departure.arrival}-${index}`}
                            >
                                <span className={styles.RailScheduleTime}>
                                    <time dateTime={time || undefined}>{formatTime(time)}</time>
                                    {until && <small>{until}</small>}
                                </span>
                                {station.kind === 'airport' && (
                                    <AirlineLogo
                                        code={departure.carrierCode}
                                        name={departure.carrier}
                                    />
                                )}
                                <div className={styles.RailScheduleTrip}>
                                    <strong>{tripTitle(departure.title, selectedEvent)}</strong>
                                    <span>
                                        {departureLabel(departure)}
                                        {departure.carrier ? ` · ${departure.carrier}` : ''}
                                    </span>
                                </div>
                                {(departure.platform || departure.terminal) && (
                                    <span className={styles.RailSchedulePlatform}>
                                        {departure.platform
                                            ? `Путь ${departure.platform}`
                                            : `Терминал ${departure.terminal}`}
                                    </span>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}

            {!loading && visibleDepartures.length > visibleCount && (
                <button
                    type="button"
                    className={styles.RailScheduleMore}
                    onClick={() => setVisibleCount((count) => count + 20)}
                >
                    Показать ещё {Math.min(20, visibleDepartures.length - visibleCount)}
                </button>
            )}

            {source && (
                <a
                    className={styles.RailScheduleSource}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                >
                    <span className={styles.RailScheduleSourceText}>
                        <strong>Полное расписание</strong>
                        <span>на сайте «{source.title}»</span>
                    </span>
                    <IconExternalLink
                        className={styles.RailScheduleSourceIcon}
                        size={18}
                        stroke={2}
                        aria-hidden="true"
                    />
                    <span className={styles.VisuallyHidden}>(откроется в новой вкладке)</span>
                </a>
            )}
        </section>
    );
}
