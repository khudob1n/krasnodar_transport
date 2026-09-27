import React, { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import {
    fetchStopSchedule,
    StopScheduleInterval as Interval,
    StopScheduleTrip as Trip,
} from 'api/ekb/collections';
import { RU_TYPE_TO_UNIT } from 'api/ekb/domain';
import { useReveal } from 'hooks/useReveal';
import { VEHICLE_TYPE_COLORS } from 'common/constants/colors';
import { ScheduleGrid } from 'components/Map/Schedule/ScheduleGrid';
import { MapVehiclesRoute } from 'components/Map/Vehicles/Route/MapVehiclesRoute';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';

import controls from 'components/Map/Schedule/ScheduleControls.module.css';
import styles from './MapStopSchedule.module.css';

const cn = classNames.bind({ ...controls, ...styles });

type DayType = 'будни' | 'выходные';

const routeKey = (item: Pick<Trip, 'route_number' | 'route_type'>) =>
    `${item.route_type}:${item.route_number}`;

const generateIntervalTimes = ({ start_time, end_time, interval_min }: Interval) => {
    const [startHour, startMinute] = start_time.split(':').map(Number);
    const [endHour, endMinute] = end_time.split(':').map(Number);
    const end = endHour * 60 + endMinute;
    const times: string[] = [];

    for (let minute = startHour * 60 + startMinute; minute <= end; minute += interval_min) {
        times.push(
            `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(
                2,
                '0',
            )}`,
        );
    }

    return times;
};

export function MapStopSchedule({ stopId }: { stopId: string }) {
    const todayIsWeekend = [0, 6].includes(new Date().getDay());
    const [dayType, setDayType] = useState<DayType>(todayIsWeekend ? 'выходные' : 'будни');
    const [trips, setTrips] = useState<Trip[]>([]);
    const [intervals, setIntervals] = useState<Interval[]>([]);
    const [selectedRoute, setSelectedRoute] = useState('');
    const [selectedDirection, setSelectedDirection] = useState('');
    const [hidePast, setHidePast] = useState(false);

    useEffect(() => {
        let active = true;
        fetchStopSchedule(stopId)
            .then((schedule) => {
                if (!active) return;
                setTrips(schedule.trips.filter((trip) => trip.day_type === dayType));
                setIntervals(
                    schedule.intervals.filter((interval) => interval.day_type === dayType),
                );
            })
            .catch((error) => {
                console.warn('Не удалось загрузить расписание остановки', error);
                if (!active) return;
                setTrips([]);
                setIntervals([]);
            });
        return () => {
            active = false;
        };
    }, [dayType, stopId]);

    const routes = useMemo(() => {
        const byKey = new Map<string, Trip | Interval>();
        [...trips, ...intervals].forEach((item) => byKey.set(routeKey(item), item));
        return Array.from(byKey.entries()).sort(([, left], [, right]) =>
            left.route_number.localeCompare(right.route_number, 'ru', { numeric: true }),
        );
    }, [intervals, trips]);

    const routeGroups = useMemo(() => {
        const groups = new Map<string, typeof routes>();

        routes.forEach(([key, route]) => {
            const current = groups.get(route.route_type) ?? [];
            groups.set(route.route_type, [...current, [key, route]]);
        });

        return Array.from(groups.entries());
    }, [routes]);

    useEffect(() => {
        if (!routes.some(([key]) => key === selectedRoute)) {
            setSelectedRoute(routes[0]?.[0] ?? '');
        }
    }, [routes, selectedRoute]);

    const directions = useMemo(
        () =>
            Array.from(
                new Set(
                    [...trips, ...intervals]
                        .filter((item) => routeKey(item) === selectedRoute)
                        .map((item) => item.to_station),
                ),
            ),
        [intervals, selectedRoute, trips],
    );

    useEffect(() => {
        if (!directions.includes(selectedDirection)) {
            setSelectedDirection(directions[0] ?? '');
        }
    }, [directions, selectedDirection]);

    const selectedTrips = trips.filter(
        (trip) => routeKey(trip) === selectedRoute && trip.to_station === selectedDirection,
    );
    const selectedIntervals = intervals.filter(
        (interval) =>
            routeKey(interval) === selectedRoute && interval.to_station === selectedDirection,
    );
    const times = selectedTrips.length
        ? selectedTrips.map(({ time }) => time)
        : selectedIntervals.flatMap(generateIntervalTimes);
    const selectedDayIsToday = todayIsWeekend === (dayType === 'выходные');

    // Расписание раскрывается - выезжает (монтируется при открытии, поэтому active - сразу).
    const rootRef = useRef<HTMLDivElement>(null);
    useReveal(rootRef, true);

    // Выбранные вкладки - цветом вида транспорта выбранного маршрута.
    const selectedType = RU_TYPE_TO_UNIT[selectedRoute.split(':')[0]];
    const accent = selectedType ? VEHICLE_TYPE_COLORS[selectedType] : undefined;

    return (
        <div
            ref={rootRef}
            className={styles.MapStopSchedule}
            style={{ '--ScheduleAccent': accent } as React.CSSProperties}
        >
            <div className={styles.MapStopScheduleGroup}>
                <span className={styles.MapStopScheduleLabel}>Маршрут</span>
                <div className={styles.MapStopScheduleRouteGroups}>
                    {routeGroups.map(([routeType, groupedRoutes]) => {
                        const type = RU_TYPE_TO_UNIT[routeType];
                        const groupIsActive = groupedRoutes.some(([key]) => key === selectedRoute);

                        return (
                            <div className={styles.MapStopScheduleRouteGroup} key={routeType}>
                                {type && (
                                    <TransportIcon
                                        type={type}
                                        className={cn(styles.MapStopScheduleRouteTypeIcon, {
                                            [styles.MapStopScheduleRouteTypeIconActive]:
                                                groupIsActive,
                                        })}
                                        alt={routeType}
                                    />
                                )}
                                <div className={controls.Tabs}>
                                    {groupedRoutes.map(([key, route]) => (
                                        <button
                                            type="button"
                                            className={cn(styles.MapStopScheduleRoute, {
                                                [styles.MapStopScheduleRouteActive]:
                                                    key === selectedRoute,
                                            })}
                                            onClick={() => setSelectedRoute(key)}
                                            key={key}
                                        >
                                            {type ? (
                                                <MapVehiclesRoute
                                                    type={type}
                                                    num={route.route_number}
                                                    size="s"
                                                />
                                            ) : (
                                                route.route_number
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={controls.Tabs}>
                {(['будни', 'выходные'] as DayType[]).map((day) => (
                    <button
                        type="button"
                        className={cn(controls.Tab, { [controls.TabActive]: dayType === day })}
                        onClick={() => setDayType(day)}
                        key={day}
                    >
                        {day === 'будни' ? 'Будни' : 'Выходные'}
                    </button>
                ))}
            </div>

            {/* Направлений несколько - выбор кнопками с общей подписью «В сторону», как «Маршрут»
                над номерами; строку «В сторону „…“» под ними не повторяем - выбранное и так
                видно по активной кнопке. Одно направление - кнопок нет, пишем его текстом. */}
            {directions.length > 1 ? (
                <div className={styles.MapStopScheduleGroup}>
                    <span className={styles.MapStopScheduleLabel}>В сторону</span>
                    <div className={controls.Tabs}>
                        {directions.map((direction) => (
                            <button
                                type="button"
                                className={cn(controls.Tab, {
                                    [controls.TabActive]: direction === selectedDirection,
                                })}
                                onClick={() => setSelectedDirection(direction)}
                                aria-pressed={direction === selectedDirection}
                                key={direction}
                            >
                                {direction}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                selectedDirection && (
                    <p className={controls.Direction}>В сторону «{selectedDirection}»</p>
                )
            )}

            <ScheduleGrid
                times={times}
                hidePast={hidePast}
                onHidePastChange={setHidePast}
                canHidePast={selectedDayIsToday}
            />
            {selectedIntervals.length > 0 && selectedTrips.length === 0 && (
                <p className={styles.MapStopScheduleNote}>
                    Время рассчитано по опубликованным интервалам движения и может отличаться от
                    фактического.
                </p>
            )}
        </div>
    );
}
