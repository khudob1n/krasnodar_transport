import React, { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames/bind';
import { useDispatch, useSelector } from 'react-redux';
import { IconCalendarTime } from '@tabler/icons-react';

import { StopInfoItem } from 'transport-common/types/masstrans';

import { State } from 'common/types/state';
import { store } from 'state';
import { setCurrentStop } from 'state/features/public-transport';
import { fetchStopSchedule } from 'api/ekb/collections';
import { loadStopRoutes, StopRoute } from 'api/ekb/domain';
import { MapVehiclesRoute } from 'components/Map/Vehicles/Route/MapVehiclesRoute';
import { FavoriteButton } from 'components/UI/FavoriteButton/FavoriteButton';
import { ShareButton, mapShareUrl } from 'components/UI/ShareButton/ShareButton';
import { useFavorites } from 'components/FavoritesProvider';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { NoServiceNotice } from 'components/Map/Schedule/NoServiceNotice';
import { JourneyStopButtons } from 'components/Map/Journey/JourneyStopButtons';

import Arrow from 'public/icons/chevron-down.svg';

import { MapStopsSidebarRow } from '../Row/MapStopsSidebarRow';
import { MapStopsSidebarStopsListItem } from './Item/MapStopsSidebarStopsListItem';
import { MapStopsSidebarStopsListSkeleton } from './Skeleton/MapStopsSidebarStopsListSkeleton';
import { MapStopSchedule } from '../Schedule/MapStopSchedule';

import pill from 'components/UI/PillButton/PillButton.module.css';
import styles from './MapStopsSidebarStopsList.module.css';
import { useMapPreferences } from 'components/MapPreferencesProvider';

const cn = classNames.bind(styles);

function directionKey(vehicle: StopInfoItem): string {
    return `${vehicle.route}-${vehicle.type}-${vehicle.to}`;
}

// Отдельный компонент, а не кнопка прямо в разметке списка: кнопка появляется только после
// загрузки расписания, а useSmoothCorners подхватывает элемент при монтировании компонента.
function ScheduleToggle({ opened, onToggle }: { opened: boolean; onToggle: () => void }) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    useSmoothCorners(buttonRef);

    return (
        <button
            ref={buttonRef}
            type="button"
            className={cn(pill.PillButton, styles.MapStopsSidebarSchedule, {
                [styles.MapStopsSidebarSchedule_opened]: opened,
            })}
            onClick={onToggle}
            aria-expanded={opened}
        >
            <IconCalendarTime className={pill.PillButtonIcon} aria-hidden="true" />
            <span>Расписание</span>
            <Arrow
                className={cn(styles.MapStopsSidebarScheduleArrow, {
                    [styles.MapStopsSidebarScheduleArrow_opened]: opened,
                })}
                aria-hidden="true"
            />
        </button>
    );
}

/**
 * Расписания у остановки нет в данных вовсе (так у ~500 остановок, в основном трамвайных) -
 * это не «сегодня не ходит»: честно говорим, что расписания нет, и показываем, что здесь ходит.
 */
function NoScheduleNotice({ routes }: { routes: StopRoute[] }) {
    return (
        <div className={cn(styles.MapStopsSidebarNoSchedule)}>
            {/* Плашка - короткая и законченная; маршруты - отдельным блоком со своим
                подзаголовком: это не часть предупреждения, с ними всё в порядке. */}
            <NoServiceNotice
                title="Расписание не опубликовано"
                text="Для этой остановки нет расписания."
            />
            {routes.length > 0 && (
                <section className={cn(styles.MapStopsSidebarRoutesSection)}>
                    <h3 className={cn(styles.MapStopsSidebarRoutesTitle)}>
                        Маршруты через остановку
                    </h3>
                    <ul className={cn(styles.MapStopsSidebarRoutesHere)}>
                        {routes.map((route) => (
                            <li key={`${route.routeId}-${route.directionTo}`}>
                                <MapVehiclesRoute type={route.type} num={route.number} size="s" />
                                <span>{route.directionTo}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

export function MapStopsSidebarStopsList({ stopId }: { stopId: string }) {
    const stopInfo = useSelector((state: State) => state.publicTransport.stopInfo || []);
    const isLoading = useSelector((state: State) => state.publicTransport.isStopInfoLoading);
    const [scheduleOpened, setScheduleOpened] = useState(false);
    const [hasSchedule, setHasSchedule] = useState(false);
    const [hasTodaySchedule, setHasTodaySchedule] = useState<boolean | null>(null);
    // null - ещё не знаем; [] и больше - расписания нет совсем, вот маршруты остановки.
    const [routesWithoutSchedule, setRoutesWithoutSchedule] = useState<StopRoute[] | null>(null);
    const { isStopFavorite, toggleStop } = useFavorites();
    const { stopDefaultView } = useMapPreferences();
    const stopName = useSelector(
        (state: State) =>
            state.publicTransport.stops?.find((stop) => stop.attributes.stopId === stopId)
                ?.attributes.title,
    );

    useEffect(() => {
        let active = true;
        // Вид карточки по умолчанию (TASK-203): расписание раскрыто сразу, если так выбрано
        // в настройках и оно у остановки есть (кнопка и блок ниже показываются по hasSchedule).
        setScheduleOpened(stopDefaultView === 'schedule');
        setHasSchedule(false);
        setHasTodaySchedule(null);
        setRoutesWithoutSchedule(null);

        fetchStopSchedule(stopId)
            .then(async ({ trips, intervals }) => {
                if (!active) return;

                const todayType = [0, 6].includes(new Date().getDay()) ? 'выходные' : 'будни';
                const records = [...trips, ...intervals];
                setHasSchedule(records.length > 0);
                setHasTodaySchedule(records.some(({ day_type }) => day_type === todayType));
                if (records.length) return;

                const routes = await loadStopRoutes().catch(() => null);
                if (active) setRoutesWithoutSchedule(routes?.get(stopId) ?? []);
            })
            .catch(() => {
                if (active) {
                    setHasSchedule(false);
                    setHasTodaySchedule(null);
                }
            });

        return () => {
            active = false;
        };
    }, [stopId]);

    // Ближайшие рейсы посчитаны на момент открытия - пока карточка висит открытой, раз в
    // минуту пересчитываем тихо (без скелетона), иначе через десять минут там «3 мин» и
    // давно ушедшие рейсы.
    const dispatch = useDispatch<typeof store.dispatch>();
    useEffect(() => {
        const timer = setInterval(() => {
            if (store.getState().publicTransport.currentStop !== stopId) return;
            dispatch(setCurrentStop({ currentStop: stopId, shouldClear: false, refresh: true }));
        }, 60 * 1000);
        return () => clearInterval(timer);
    }, [dispatch, stopId]);

    const nearestItems = useMemo(() => {
        const seenDirections = new Set<string>();
        const nearest: StopInfoItem[] = [];

        stopInfo.forEach((vehicle) => {
            const key = directionKey(vehicle);

            if (!seenDirections.has(key)) {
                seenDirections.add(key);
                nearest.push(vehicle);
            }
        });

        return nearest;
    }, [stopInfo]);

    if (isLoading) {
        return (
            <MapStopsSidebarRow mix={styles.MapStopsSidebarStopsList}>
                <MapStopsSidebarStopsListSkeleton />
            </MapStopsSidebarRow>
        );
    }

    return (
        <MapStopsSidebarRow mix={styles.MapStopsSidebarStopsList}>
            {nearestItems.map((vehicle) => (
                <MapStopsSidebarStopsListItem
                    vehicle={vehicle}
                    stopName={stopName}
                    key={`${vehicle.route}-${vehicle.arriveTime}`}
                />
            ))}
            {routesWithoutSchedule !== null && <NoScheduleNotice routes={routesWithoutSchedule} />}
            {hasSchedule && hasTodaySchedule === false && <NoServiceNotice />}
            {/* Сегодня ходил, но рейсы на сегодня кончились - без плашки карточка была пустой. */}
            {hasTodaySchedule && !nearestItems.length && (
                <NoServiceNotice
                    title="Сегодня рейсов больше нет"
                    text="Следующие отправления — завтра, их видно в расписании"
                />
            )}
            {/* Действия с остановкой - под ближайшими рейсами: здесь их ищут после того, как
                посмотрели, что подъезжает (TASK-181). Маршрут - первой парой, чтобы «отсюда» и
                «сюда» всегда стояли рядом, есть расписание у остановки или нет. */}
            <div className={pill.PillButtonGrid}>
                <JourneyStopButtons stopId={stopId} />
                {hasSchedule && (
                    <ScheduleToggle
                        opened={scheduleOpened}
                        onToggle={() => setScheduleOpened(!scheduleOpened)}
                    />
                )}
                <FavoriteButton
                    subject="остановку"
                    isActive={isStopFavorite(stopId)}
                    onToggle={() => toggleStop(stopId)}
                />
                <ShareButton
                    url={mapShareUrl({ stop: stopId })}
                    title="Остановка на карте транспорта"
                />
            </div>
            {hasSchedule && scheduleOpened && <MapStopSchedule stopId={stopId} />}
        </MapStopsSidebarRow>
    );
}
