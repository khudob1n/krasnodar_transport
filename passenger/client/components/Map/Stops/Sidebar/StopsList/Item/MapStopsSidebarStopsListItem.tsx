import React, { useCallback, useMemo, useState } from 'react';
import classNames from 'classnames/bind';
import { useDispatch, useSelector } from 'react-redux';

import { StopInfoItem } from 'transport-common/types/masstrans';

import { VEHICLE_TYPE_COLORS } from 'common/constants/colors';
import { State } from 'common/types/state';
import { MapVehiclesRoute } from 'components/Map/Vehicles/Route/MapVehiclesRoute';
import { store } from 'state';
import { setCurrentVehicle } from 'state/features/public-transport';
import t from 'utils/typograph';
import { useMapPreferences } from 'components/MapPreferencesProvider';

import { getArriveDate, formatArrival, getTimeToArrive } from './MapStopsSidebarStopsListItem.utils';
import { IconBell, IconBellRingingFilled } from '@tabler/icons-react';
import {
    REMIND_BEFORE_MINUTES,
    addReminder,
    cancelReminder,
    notificationsSupported,
    useReminder,
} from 'services/reminders/reminders';
import { vehiclesName } from 'components/Map/Vehicles/Sidebar/MapVehiclesSidebar.constants';

import styles from './MapStopsSidebarStopsListItem.module.css';

const cn = classNames.bind(styles);

export interface MapStopsSidebarStopsListItemProps {
    vehicle: StopInfoItem;
    /** Название остановки - для текста напоминания. */
    stopName?: string;
}

/**
 * Колокольчик «Напомнить» (TASK-208): уведомление за 3 минуты до прибытия. Для рейсов,
 * которые придут раньше чем через 3 минуты, не показывается - напоминать уже поздно.
 */
function ReminderButton({ vehicle, stopName }: MapStopsSidebarStopsListItemProps) {
    const key = `${vehicle.type}-${vehicle.route}-${vehicle.routeDirection}-${vehicle.arriveTime}-${stopName}`;
    const active = useReminder(key);
    const [denied, setDenied] = useState(false);

    if (!notificationsSupported()) return null;

    // Место под колокольчик держим и там, где он не нужен, - иначе время в строках скакало бы.
    if (getTimeToArrive(vehicle.arriveTime) <= REMIND_BEFORE_MINUTES) {
        return (
            <span className={cn(styles.MapStopsSidebarVehicleReminderSpacer)} aria-hidden="true" />
        );
    }

    const name = vehiclesName[vehicle.type];
    const label = denied
        ? 'Уведомления запрещены в браузере'
        : active
          ? `Отменить напоминание о ${vehicle.route}`
          : `Напомнить за ${REMIND_BEFORE_MINUTES} минуты до прибытия ${vehicle.route}`;

    const toggle = async () => {
        if (active) {
            cancelReminder(key);
            return;
        }

        const fireAt = new Date(
            getArriveDate(vehicle.arriveTime).getTime() - REMIND_BEFORE_MINUTES * 60000,
        );
        const ok = await addReminder(key, fireAt, {
            title: `${name[0].toUpperCase()}${name.slice(1)} ${vehicle.route} подходит`,
            body: `Через ${REMIND_BEFORE_MINUTES} минуты${stopName ? ` на остановке «${stopName}»` : ''} · в сторону «${vehicle.to}»`,
        });
        setDenied(!ok);
    };

    const Icon = active ? IconBellRingingFilled : IconBell;

    return (
        <button
            type="button"
            className={cn(styles.MapStopsSidebarVehicleReminder, {
                [styles.MapStopsSidebarVehicleReminder_active]: active,
            })}
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={(event) => {
                // Строка сама кликабельна (выбор маршрута) - колокольчик не должен её трогать.
                event.stopPropagation();
                toggle();
            }}
        >
            <Icon size={18} stroke={2} aria-hidden="true" />
        </button>
    );
}

export function MapStopsSidebarStopsListItem({
    vehicle,
    stopName,
}: MapStopsSidebarStopsListItemProps) {
    const dispatch = useDispatch<typeof store.dispatch>();
    const currentVehicleRoute = useSelector(
        (state: State) => state.publicTransport.currentVehicle?.num,
    );

    const { arrivalFormat } = useMapPreferences();

    // Формат из настроек (TASK-202): «через N мин» (дальше 15 минут - всё равно часы, минуты
    // тут уже неудобно считать) или всегда точное время.
    const timeToArrive = formatArrival(vehicle.arriveTime, arrivalFormat);

    const setSelectedVehicle = useCallback(() => {
        if (vehicle.route === currentVehicleRoute) {
            dispatch(setCurrentVehicle(null));

            return;
        }

        dispatch(
            setCurrentVehicle({
                num: vehicle.route,
                routeDirection: vehicle.routeDirection,
                type: vehicle.type,
                routeId: vehicle.routeId,
                shouldClear: false,
                shouldFlyTo: true,
            }),
        );
    }, [
        dispatch,
        vehicle.route,
        vehicle.routeDirection,
        vehicle.type,
        currentVehicleRoute,
        vehicle.routeId,
    ]);

    return (
        <div
            key={`${vehicle.route}-${vehicle.type}-${vehicle.arriveTime}`}
            className={cn(styles.MapStopsSidebarVehicle, {
                [styles.MapStopsSidebarVehicle_isSelected]: currentVehicleRoute === vehicle.route,
            })}
            onClick={setSelectedVehicle}
            // Строка выбирается и с клавиатуры: это кнопка «показать рейс на карте».
            role="button"
            tabIndex={0}
            aria-pressed={currentVehicleRoute === vehicle.route}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedVehicle();
                }
            }}
            style={
                {
                    '--vehicle-color': VEHICLE_TYPE_COLORS[vehicle.type],
                } as React.CSSProperties
            }
        >
            <div className={cn(styles.MapStopsSidebarVehicleInfo)}>
                <MapVehiclesRoute type={vehicle.type} num={vehicle.route} />
                <div className={cn(styles.MapStopsSidebarVehicleText)}>
                    <span className={cn(styles.MapStopsSidebarVehicleEndpoint)}>
                        {t(vehicle.to)}
                    </span>
                    {Boolean(vehicle.through.length) && (
                        <>
                            <br />
                            <span className={cn(styles.MapStopsSidebarVehicleKeypoints)}>
                                {t(`через ${vehicle.through.join(', ')}`)}
                            </span>
                        </>
                    )}
                </div>
            </div>
            <div className={cn(styles.MapStopsSidebarVehicleArriveTime)}>
                {timeToArrive}
                <ReminderButton vehicle={vehicle} stopName={stopName} />
            </div>
        </div>
    );
}
