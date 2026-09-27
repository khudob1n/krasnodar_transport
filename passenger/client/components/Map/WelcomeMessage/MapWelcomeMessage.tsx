import React, { useEffect, useState } from 'react';
import classNames from 'classnames/bind';
import { IconAlertTriangle, IconWalk } from '@tabler/icons-react';
import { StopType } from 'transport-common/types/masstrans';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';

import { Divider } from 'components/UI/Divider/Divider';
import { Typography } from 'components/UI/Typography/Typography';
import { PageText } from 'components/UI/Typography/PageText/PageText';
import { hotkeysAvailable } from 'services/hotkeys';

import { StationIcon } from 'components/UI/StationIcon/StationIcon';

import railStyles from 'components/Map/Rail/Rail.module.css';
import stopStyles from 'components/Map/Stops/Item/MapStopsItem.module.css';
import styles from './MapWelcomeMessage.module.css';

const cn = classNames.bind(styles);

// Значки остановок - те же, что на карте (кружок MapStopsItemPin), чтобы обозначения
// не расходились с тем, что пассажир видит на карте.
const STOPS = [
    { type: StopType.Troll, title: 'Остановка троллейбуса' },
    { type: StopType.Bus, title: 'Остановка автобуса' },
    { type: StopType.Tram, title: 'Остановка трамвая' },
    { type: StopType.TrollBus, title: 'Остановка автобуса и троллейбуса' },
];

const STATIONS = [
    { kind: 'railway_station', title: 'Железнодорожная станция' },
    { kind: 'bus_terminal', title: 'Автовокзал' },
    { kind: 'airport', title: 'Аэропорт' },
] as const;

const DEPOTS = ['tram', 'troll', 'bus'] as const;

export function MapWelcomeMessage() {
    // Про горячие клавиши - только там, где они есть (десктоп). Проверяем после монтирования:
    // при серверной отрисовке window нет.
    const [hotkeys, setHotkeys] = useState(false);
    useEffect(() => setHotkeys(hotkeysAvailable()), []);

    return (
        <div className={cn(styles.MapWelcomeMessage)}>
            <div className={cn(styles.MapWelcomeMessageRow)}>
                <Typography variant="h3">
                    Привет!
                    <br />
                    Это карта транспорта Краснодара
                    <IconWalk
                        className={cn(styles.MapWelcomeMessageWalk)}
                        size="1em"
                        stroke={2}
                        aria-hidden
                    />
                </Typography>
                <div className={cn(styles.MapWelcomeMessageDescription)}>
                    <PageText>
                        В карточках транспорта можно посмотреть что за автобус, троллейбус или
                        трамвай едет к вам.
                    </PageText>
                    <PageText>А на остановках — сколько ждать нужный вам маршрут.</PageText>
                    <PageText>
                        Чтобы открыть карточку — кликните на любой транспорт или остановку на карте.
                    </PageText>
                    {hotkeys && (
                        <PageText>
                            С клавиатуры быстрее: нажмите{' '}
                            <kbd className={cn(styles.MapWelcomeMessageKey)}>?</kbd>, чтобы увидеть
                            все горячие клавиши.
                        </PageText>
                    )}
                </div>
            </div>
            <Divider />
            <div className={cn(styles.MapWelcomeMessageRow)}>
                <Typography variant="h3">Условные обозначения</Typography>
                <ul className={cn(styles.MapWelcomeMessageNotations)}>
                    {STOPS.map(({ type, title }) => (
                        <li key={type} className={cn(styles.MapWelcomeMessageNotation)}>
                            <PageText>{title}</PageText>
                            <span
                                className={cn(
                                    stopStyles.MapStopsItemPin,
                                    styles.MapWelcomeMessagePin,
                                )}
                                aria-hidden="true"
                            >
                                <TransportIcon type={type} variant="stop" alt="" />
                            </span>
                        </li>
                    ))}
                    <li className={cn(styles.MapWelcomeMessageNotation)}>
                        <PageText>Низкопольный транспорт</PageText>
                        <span className={cn(styles.MapWelcomeMessageFeature)} aria-hidden="true">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/icons/tram-accessibility.svg"
                                width={20}
                                height={20}
                                alt=""
                            />
                        </span>
                    </li>
                    <li className={cn(styles.MapWelcomeMessageNotation)}>
                        <PageText>Едет не по маршруту</PageText>
                        <span className={cn(styles.MapWelcomeMessageFeature)} aria-hidden="true">
                            <IconAlertTriangle size={20} stroke={2.2} color="#E09B00" />
                        </span>
                    </li>
                    {STATIONS.map(({ kind, title }) => (
                        <li key={kind} className={cn(styles.MapWelcomeMessageNotation)}>
                            <PageText>{title}</PageText>
                            <span
                                className={cn(
                                    railStyles.RailMarkerPin,
                                    styles.MapWelcomeMessagePin,
                                )}
                                aria-hidden="true"
                            >
                                <StationIcon kind={kind} alt="" />
                            </span>
                        </li>
                    ))}
                    <li className={cn(styles.MapWelcomeMessageNotation)}>
                        <PageText>Депо и автобусные парки</PageText>
                        <span className={cn(styles.MapWelcomeMessageSample)} aria-hidden="true">
                            {DEPOTS.map((kind) => (
                                <span
                                    key={kind}
                                    className={cn(styles.MapWelcomeMessageArea)}
                                    style={
                                        { '--AreaColor': `var(--${kind})` } as React.CSSProperties
                                    }
                                />
                            ))}
                        </span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
