// FIXME: cure divatosis
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import classNames from 'classnames/bind';
import { useDispatch, useSelector } from 'react-redux';
import { useMap } from 'react-leaflet';
import { flyToVisible } from 'components/Map/mapViewport';
import { DevIds } from 'components/UI/DevIds/DevIds';

import { store } from 'state';
import t from 'utils/typograph';

import {
    ClientUnit,
    ImageSizes,
    Unit,
    UnitArriveStop,
    UnitInfo,
} from 'transport-common/types/masstrans';
import { STRAPI_URL } from 'transport-common/strapi/constants';

import { massTransApi, VehicleUnit } from 'api/masstrans/masstrans';
import { VEHICLE_TYPE_COLORS, VEHICLE_TYPE_TRANSLUCENT_COLORS } from 'common/constants/colors';

import { Divider } from 'components/UI/Divider/Divider';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { useReveal } from 'hooks/useReveal';

import Arrow from 'public/icons/chevron-down.svg';

import { getNoun } from 'utils/plural';

import { PageText } from 'components/UI/Typography/PageText/PageText';
import { Typography } from 'components/UI/Typography/Typography';

import { MapVehiclesItemProps } from '../Item/MapVehiclesItem.types';
import { MapVehicleMarker } from '../Marker/MapVehicleMarker';

import Velocity from './Velocity/velocity.svg';
import VelocityColor from './Velocity/velocity-color.svg';

import {
    additionalHeader,
    vehiclesName,
    KRASNODAR_REGION,
    featuresTitle,
} from './MapVehiclesSidebar.constants';
import { getPointsRow } from './MapVehiclesSidebar.utils';

import styles from './MapVehiclesSidebar.module.css';
import { setCurrentStop } from 'state/features/public-transport';
import { sidebarService } from 'services/sidebar/sidebar';
import { MapStopsSidebar } from 'components/Map/Stops/Sidebar/MapStopsSidebar';
import { State } from 'common/types/state';
import { MapVehiclesRoute } from '../Route/MapVehiclesRoute';
import { formatAge, isStale, navTimeAgeMs } from '../staleness';
import { ShareButton, mapShareUrl } from 'components/UI/ShareButton/ShareButton';
import { useFavorites } from 'components/FavoritesProvider';
import { IconAlertTriangle, IconFocus2 } from '@tabler/icons-react';
import pill from 'components/UI/PillButton/PillButton.module.css';
import { useFollowVehicle } from '../useFollowVehicle';

export interface MapVehiclesSidebarProps extends Unit {
    warning: MapVehiclesItemProps['warning'];
    navTime?: string;
    /** false - источник скорость не отдаёт (фид Краснодара), спидометр не показываем. */
    hasSpeed?: boolean;
}

const cn = classNames.bind(styles);

// function IconComponent({ feature, className }: { feature: string; className: string }) {
//     const NeedIcon = dynamic<any>(() => import(`public/icons/${feature}.svg`), {
//         loading: () => null,
//         ssr: false,
//     });
//     console.log(NeedIcon);
//     return <NeedIcon className={className} />;
// }

export function MapVehiclesSidebar({
    id,
    routeId,
    routeDirection,
    boardId,
    speed: initialSpeed,
    hasSpeed = true,
    num,
    type,
    stateNumber,
    warning,
    accessibility,
    firstStation,
    lastStation,
    depoTitle,
    coords: initialCoords,
    navTime: initialNavTime,
}: MapVehiclesSidebarProps) {
    // Пропсы - снимок на момент открытия карточки, а машина едет: координаты, скорость и
    // свежесть берём из стора (обновляется каждые 30 с), пока машина в фиде.
    const live = useSelector((state: State) =>
        (state.publicTransport.units[type] as VehicleUnit[] | undefined)?.find(
            (unit) => unit.id === id,
        ),
    );
    const coords = live?.coords ?? initialCoords;
    const speed = live?.speed ?? initialSpeed;
    const navTime = live?.navTime ?? initialNavTime;
    const dispatch = useDispatch<typeof store.dispatch>();
    const [from, to] = [firstStation, lastStation];
    const [stops, setStops] = useState<UnitArriveStop[]>([]);
    const [unitInfo, setUnitInfo] = useState<UnitInfo>(null);
    const latLngCoords = useMemo(() => new L.LatLng(coords[0], coords[1]), [coords[0], coords[1]]);
    const map = useMap();
    const roadNumberRef = useRef<HTMLDivElement>(null);

    useSmoothCorners(roadNumberRef);

    useEffect(() => {
        let active = true;
        // Переключились на другую машину, пока грузились остановки этой, - ответ уже не нужен.
        massTransApi.getVehicleInfo(id).then((stopsRes) => {
            if (active) setStops(stopsRes || []);
        });
        return () => {
            active = false;
        };
    }, [id]);

    useEffect(() => {
        massTransApi
            .getUnitInfo({
                type,
                boardId,
                stateNumber,
                num,
            })
            .then((unitInfoRes) => {
                const unitInfoItem = unitInfoRes[0];

                setUnitInfo(unitInfoItem?.attributes);
            });
    }, [type, boardId, stateNumber, num]);

    const stateNumberObject = useMemo(() => {
        const splittedStateNum = stateNumber.toLocaleLowerCase().split(' ');
        if (splittedStateNum.length === 1) {
            return null;
        }

        const roadNumber = splittedStateNum.slice(0, -1);
        let region = splittedStateNum.at(-1);

        if (!parseInt(region, 10)) {
            roadNumber.push(region);
            region = KRASNODAR_REGION;
        }

        return {
            number: roadNumber,
            region: region,
        };
    }, [stateNumber]);

    const vehicleOperator = useMemo(() => {
        if (type !== ClientUnit.Bus) {
            return {
                title: 'Гортранс',
                subTitle: depoTitle,
            };
        }

        const depoTitleMatch = depoTitle.match(/(.+)\s+\((.+)\)/);

        return {
            title: depoTitleMatch ? depoTitleMatch?.[1] : depoTitle,
            subTitle: depoTitleMatch?.[2] ? `Филиал ${depoTitleMatch?.[2]}` : undefined,
        };
    }, [depoTitle]);

    const manufactureYearDiff = useMemo(() => {
        if (!unitInfo?.year) {
            return 0;
        }

        const numberYear = parseInt(unitInfo.year.match(/((\d+)\.)?(\d{4})/)[3], 10);

        return new Date().getFullYear() - numberYear;
    }, [unitInfo?.year]);

    const [afterOpened, setAfterOpened] = useState(false);
    const [beforeOpened, setBeforeOpened] = useState(false);
    const [additionalOpened, setAdditionalOpened] = useState(false);

    const nearestStopIndex = useMemo(
        () =>
            Math.max(
                stops.reduce(
                    (acc, stop, idx) => {
                        if (!stop.coords || !latLngCoords) {
                            return acc;
                        }

                        const distance = latLngCoords.distanceTo(stop.coords);

                        if (distance < acc.distance) {
                            acc.idx = idx;
                            acc.distance = distance;
                        }

                        return acc;
                    },
                    { idx: 0, distance: Infinity },
                ).idx,
                0,
            ),
        [stops, latLngCoords],
    );
    const afterStart = useMemo(() => stops.slice(1, nearestStopIndex), [stops, nearestStopIndex]);
    const lastNearestIndex = useMemo(
        () => Math.min(nearestStopIndex + 4, stops.length - 1),
        [stops, nearestStopIndex],
    );
    const afterNearest = useMemo(
        () => stops.slice(nearestStopIndex + 1, lastNearestIndex),
        [stops, nearestStopIndex, lastNearestIndex],
    );
    const beforeEnd = useMemo(
        () => stops.slice(lastNearestIndex, stops.length - 1),
        [stops, lastNearestIndex],
    );
    const endStop = useMemo(() => stops[stops.length - 1], [stops]);

    // «До моей остановки» (TASK-209): последняя открытая остановка, а если её нет впереди -
    // первая избранная, до которой машина ещё доедет.
    const lastStop = useSelector((state: State) => state.publicTransport.lastStop);
    const { stopIds: favoriteStopIds, stopNames } = useFavorites();
    const stopsToTarget = useMemo(() => {
        const ahead = stops.slice(nearestStopIndex + 1);
        const candidates = [lastStop, ...favoriteStopIds].filter(Boolean);

        for (const targetId of candidates) {
            const index = ahead.findIndex((stop) => stop.stopId === targetId);
            if (index !== -1) {
                return { name: stopNames[targetId] || ahead[index].title, count: index + 1 };
            }
        }

        return null;
    }, [stops, nearestStopIndex, lastStop, favoriteStopIds, stopNames]);

    // Раскрытие: «Подробнее» выезжает, скрытые остановки появляются лесенкой.
    const additionalRef = useRef<HTMLDivElement>(null);
    const afterRef = useRef<HTMLDivElement>(null);
    const beforeRef = useRef<HTMLDivElement>(null);
    useReveal(additionalRef, additionalOpened);
    useReveal(afterRef, afterOpened, { items: 'li', container: false });
    useReveal(beforeRef, beforeOpened, { items: 'li', container: false });

    const [following, setFollowing] = useState(false);
    const stopFollowing = useCallback(() => setFollowing(false), []);
    useFollowVehicle(`vehicle-${id}-${num}`, following, stopFollowing);
    const followRef = useRef<HTMLButtonElement>(null);
    useSmoothCorners(followRef);

    const allStops = useSelector((state: State) => state.publicTransport.stops);
    const setSelectedStop = useCallback(
        (stopId: string) => {
            const stop = allStops.find((stopFullData) => stopFullData.attributes.stopId === stopId);

            if (!stop) {
                return;
            }

            const { attributes: stopData } = stop;

            dispatch(
                setCurrentStop({
                    currentStop: stopId,
                    shouldClear: false,
                }),
            );

            flyToVisible(map, stopData.coords, 15);

            sidebarService.open({
                component: (
                    <MapStopsSidebar type={stopData.type} name={stopData.title} stopId={stopId} />
                ),
                onClose: () => dispatch(setCurrentStop(null)),
            });
        },
        // allStops - иначе карточка, открытая до загрузки остановок, не открывала ни одну.
        [dispatch, allStops, map],
    );

    return (
        <div
            className={cn(styles.MapVehiclesSidebar)}
            style={
                {
                    '--vehicle-color': VEHICLE_TYPE_COLORS[type],
                } as React.CSSProperties
            }
        >
            <div className={cn(styles.MapVehiclesSidebarWrapper)} data-card-stagger>
                {unitInfo?.image.data && (
                    <div className={cn(styles.MapVehiclesSidebarVehicleImageWrapper)}>
                        <img
                            src={`${STRAPI_URL}${
                                unitInfo?.image.data.attributes.formats[ImageSizes.Small].url
                            }`}
                            className={cn(styles.MapVehiclesSidebarVehicleImage)}
                            width={448}
                            height={250}
                            alt={`Маршрут №${num}`}
                        />
                    </div>
                )}
                <div className={cn(styles.MapVehiclesSidebarVehicleInfoWrapper)}>
                    <div className={cn(styles.MapVehiclesSidebarVehicleInfo)}>
                        <TransportIcon
                            type={type}
                            width={32}
                            height={32}
                            style={{ fill: 'var(--vehicle-color)' }}
                            alt={type}
                        />
                        <MapVehiclesRoute type={type} num={num} size="l" />
                        <div className={cn(styles.MapVehiclesSidebarVehicleFeatures)}>
                            {accessibility && (
                                <abbr title={featuresTitle.accessibility} style={{ fontSize: 0 }}>
                                    <img
                                        src={`/icons/${type}-accessibility.svg`}
                                        width={32}
                                        height={32}
                                        alt={featuresTitle.accessibility}
                                    />
                                </abbr>
                            )}
                            {warning && (
                                <abbr title={featuresTitle.warning} style={{ fontSize: 0 }}>
                                    <IconAlertTriangle
                                        size={26}
                                        stroke={2}
                                        color="#E09B00"
                                        aria-label={featuresTitle.warning}
                                    />
                                </abbr>
                            )}
                        </div>
                    </div>
                    {/* Скорость из устаревших координат ничего не говорит о текущей - не показываем. */}
                    {hasSpeed && !isStale(navTime) && (
                        <div className={cn(styles.MapVehiclesSidebarVelocity)}>
                            <Velocity className={cn(styles.MapVehiclesSidebarVelocityIcon)} />
                            <VelocityColor
                                className={cn(
                                    styles.MapVehiclesSidebarVelocityColorIcon,
                                    styles[`MapVehiclesSidebarVelocityColorIcon_${type}`],
                                )}
                            />
                            <span
                                className={cn(styles.MapVehiclesSidebarVelocityValue)}
                                style={{ color: VEHICLE_TYPE_COLORS[type] }}
                            >
                                {speed}
                            </span>
                            <span className={cn(styles.MapVehiclesSidebarVelocityMeasure)}>
                                км/ч
                            </span>
                        </div>
                    )}
                </div>
                <div className={cn(styles.MapVehiclesSidebarDevIds)}>
                    <DevIds
                        items={[
                            ['ID машины', id],
                            ['ID маршрута', routeId],
                            ['ID направления', routeDirection],
                        ]}
                    />
                </div>
                <div className={cn(styles.MapVehiclesSidebarDirectionInfo)}>
                    <ul className={cn(styles.MapVehiclesSidebarDirection)}>
                        <li className={cn(styles.MapVehiclesSidebarHeaderStation)}>
                            <div className={cn(styles.MapVehiclesSidebarHeaderBullet)} />
                            <Typography variant="h4">{from}</Typography>
                        </li>
                        <li className={cn(styles.MapVehiclesSidebarHeaderStation)}>
                            <div
                                className={cn(
                                    styles.MapVehiclesSidebarHeaderBullet,
                                    styles.MapVehiclesSidebarHeaderBullet_fill,
                                    {
                                        [styles.MapVehiclesSidebarHeaderBullet_warning]: warning,
                                    },
                                )}
                            />
                            <Typography
                                variant="h4"
                                className={cn({ [styles.MapVehiclesSidebarTo_warning]: warning })}
                            >
                                {to}
                            </Typography>
                        </li>
                    </ul>
                    {warning && (
                        <span className={cn(styles.MapVehiclesSidebarWarningInfo)}>
                            {`${vehiclesName[type]} едет по измененному маршруту`}
                        </span>
                    )}
                    {isStale(navTime) && (
                        <span className={cn(styles.MapVehiclesSidebarStaleInfo)}>
                            {`Координаты обновлялись ${formatAge(navTimeAgeMs(navTime))} — машина может быть уже в другом месте`}
                        </span>
                    )}
                    {stopsToTarget && (
                        <span className={cn(styles.MapVehiclesSidebarStaleInfo)}>
                            {`До «${stopsToTarget.name}» — ${stopsToTarget.count} ${getNoun(
                                stopsToTarget.count,
                                'остановка',
                                'остановки',
                                'остановок',
                            )}`}
                        </span>
                    )}
                    <div className={cn(pill.PillButtonGrid, styles.MapVehiclesSidebarActions)}>
                        <button
                            ref={followRef}
                            type="button"
                            className={cn(pill.PillButton, {
                                [styles.MapVehiclesSidebarFollow_active]: following,
                            })}
                            aria-pressed={following}
                            onClick={() => setFollowing(!following)}
                            title="Карта будет держать машину в центре"
                        >
                            <IconFocus2 className={pill.PillButtonIcon} aria-hidden="true" />
                            <span>
                                {following ? 'Наблюдаю за движением' : 'Наблюдать за движением'}
                            </span>
                        </button>
                        <ShareButton
                            url={mapShareUrl({ vehicle: id })}
                            title={`${vehiclesName[type][0].toUpperCase()}${vehiclesName[type].slice(1)} № ${num} на карте транспорта`}
                        />
                    </div>
                </div>
                {stops.length > 0 && (
                    <div className={cn(styles.MapVehiclesSidebarStopsWrapper)}>
                        <Divider />
                        <ul
                            className={cn(
                                styles.MapVehiclesSidebarStops,
                                styles[`MapVehiclesSidebarStops_${type}`],
                            )}
                        >
                            {/* TODO: вытащить li в компонент */}
                            {nearestStopIndex !== 0 && (
                                <li
                                    className={cn(styles.MapVehiclesSidebarStop)}
                                    onClick={() => setSelectedStop(stops[0].stopId)}
                                >
                                    <div
                                        className={cn(
                                            styles.MapVehiclesSidebarBullet,
                                            styles.MapVehiclesSidebarBullet_big,
                                        )}
                                        style={{
                                            borderColor: VEHICLE_TYPE_TRANSLUCENT_COLORS[type],
                                        }}
                                    />
                                    <PageText
                                        className={cn(
                                            styles.MapVehiclesSidebarStopName,
                                            styles.MapVehiclesSidebarStartStation,
                                        )}
                                    >
                                        {stops[0].title}
                                    </PageText>
                                </li>
                            )}
                            {afterStart.length > 0 && (
                                <div
                                    ref={afterRef}
                                    className={cn(styles.MapVehiclesSidebarHiddenStationWrapper)}
                                    onClick={() => {
                                        setAfterOpened(!afterOpened);
                                    }}
                                >
                                    {!afterOpened && (
                                        <div className={cn(styles.MapVehiclesSidebarHiddenCount)}>
                                            {getPointsRow(afterStart.length)}
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            styles.MapVehiclesSidebarHiddenCountTextWrapper,
                                        )}
                                    >
                                        <PageText>
                                            {`${afterStart.length} ${getNoun(
                                                afterStart.length,
                                                'остановка',
                                                'остановки',
                                                'остановок',
                                            )}`}
                                        </PageText>
                                        <Arrow
                                            className={cn(styles.MapVehiclesSidebarHiddenArrow, {
                                                [styles.MapVehiclesSidebarHiddenArrow_opened]:
                                                    afterOpened,
                                            })}
                                        />
                                    </div>
                                    {afterOpened &&
                                        afterStart.map((stop) => (
                                            <li
                                                className={cn(styles.MapVehiclesSidebarStop)}
                                                onClick={() => setSelectedStop(stop.stopId)}
                                            >
                                                <div
                                                    className={cn(styles.MapVehiclesSidebarBullet)}
                                                    style={{
                                                        borderColor:
                                                            VEHICLE_TYPE_TRANSLUCENT_COLORS[type],
                                                    }}
                                                />
                                                <PageText
                                                    className={cn(
                                                        styles.MapVehiclesSidebarStopName,
                                                    )}
                                                >
                                                    {stop.title}
                                                </PageText>
                                            </li>
                                        ))}
                                </div>
                            )}
                            <div className={cn(styles.MapVehiclesSidebarActiveStops)}>
                                <div
                                    className={cn(styles.MapVehiclesSidebarActiveBorder)}
                                    style={{ backgroundColor: VEHICLE_TYPE_COLORS[type] }}
                                />
                                <li
                                    className={cn(styles.MapVehiclesSidebarStop)}
                                    onClick={() => setSelectedStop(stops[nearestStopIndex].stopId)}
                                >
                                    <div className={cn(styles.MapVehiclesSidebarVehicleMarker)}>
                                        <MapVehicleMarker
                                            id="sidebar"
                                            routeNumber={num}
                                            type={type}
                                            isCourseEast={false}
                                            additionalInfo={false}
                                            course={180}
                                        />
                                    </div>
                                    <PageText className={cn(styles.MapVehiclesSidebarStopName)}>
                                        {stops[nearestStopIndex]?.title}
                                    </PageText>
                                </li>
                                {afterNearest.map((stop) => (
                                    <li
                                        className={cn(styles.MapVehiclesSidebarStop)}
                                        onClick={() => setSelectedStop(stop.stopId)}
                                    >
                                        <div
                                            className={cn(styles.MapVehiclesSidebarBullet)}
                                            style={{ borderColor: VEHICLE_TYPE_COLORS[type] }}
                                        />
                                        <PageText className={cn(styles.MapVehiclesSidebarStopName)}>
                                            {t(stop.title)}
                                        </PageText>
                                        {'arriveTime' in stop && (
                                            <PageText>{stop.arriveTime}</PageText>
                                        )}
                                    </li>
                                ))}
                                {beforeEnd.length > 0 && (
                                    <div
                                        ref={beforeRef}
                                        className={cn(
                                            styles.MapVehiclesSidebarHiddenStationWrapper,
                                        )}
                                        onClick={() => {
                                            setBeforeOpened(!beforeOpened);
                                        }}
                                    >
                                        {!beforeOpened && (
                                            <div
                                                className={cn(styles.MapVehiclesSidebarHiddenCount)}
                                            >
                                                {getPointsRow(beforeEnd.length)}
                                            </div>
                                        )}
                                        <div
                                            className={cn(
                                                styles.MapVehiclesSidebarHiddenCountTextWrapper,
                                            )}
                                        >
                                            <PageText>
                                                {`${beforeEnd.length} ${getNoun(
                                                    beforeEnd.length,
                                                    'остановка',
                                                    'остановки',
                                                    'остановок',
                                                )}`}
                                            </PageText>
                                            <Arrow
                                                className={cn(
                                                    styles.MapVehiclesSidebarHiddenArrow,
                                                    {
                                                        [styles.MapVehiclesSidebarHiddenArrow_opened]:
                                                            beforeOpened,
                                                    },
                                                )}
                                            />
                                        </div>
                                        {beforeOpened &&
                                            beforeEnd.map((stop) => (
                                                <li
                                                    className={cn(styles.MapVehiclesSidebarStop)}
                                                    onClick={() => setSelectedStop(stop.stopId)}
                                                >
                                                    <div
                                                        className={cn(
                                                            styles.MapVehiclesSidebarBullet,
                                                        )}
                                                        style={{
                                                            borderColor: VEHICLE_TYPE_COLORS[type],
                                                        }}
                                                    />
                                                    <PageText
                                                        className={cn(
                                                            styles.MapVehiclesSidebarStopName,
                                                        )}
                                                    >
                                                        {t(stop.title)}
                                                    </PageText>
                                                    {'arriveTime' in stop && (
                                                        <PageText>{t(stop.arriveTime)}</PageText>
                                                    )}
                                                </li>
                                            ))}
                                    </div>
                                )}
                                {stops.length > 0 && nearestStopIndex !== stops.length - 1 && (
                                    <li
                                        className={cn(styles.MapVehiclesSidebarStop)}
                                        onClick={() => setSelectedStop(endStop.stopId)}
                                    >
                                        <div
                                            className={cn(
                                                styles.MapVehiclesSidebarBullet,
                                                styles.MapVehiclesSidebarBullet_big,
                                            )}
                                            style={{ borderColor: VEHICLE_TYPE_COLORS[type] }}
                                        />
                                        <PageText className={cn(styles.MapVehiclesSidebarStopName)}>
                                            {t(endStop.title)}
                                        </PageText>

                                        {'arriveTime' in endStop && (
                                            <PageText>{endStop.arriveTime}</PageText>
                                        )}
                                    </li>
                                )}
                            </div>
                        </ul>
                    </div>
                )}
                <Divider />
                <div className={cn(styles.MapVehiclesSidebarAdditionalWrapper)}>
                    <div
                        className={cn(styles.MapVehiclesSidebarAdditionalHeader)}
                        onClick={() => setAdditionalOpened(!additionalOpened)}
                    >
                        <Typography
                            className={cn(styles.MapVehiclesSidebarAdditionalTitle)}
                            variant="h3"
                        >
                            {`Подробнее ${additionalHeader[type]}`}
                        </Typography>
                        <Arrow
                            className={cn(styles.MapVehiclesSidebarAdditionalArrow, {
                                [styles.MapVehiclesSidebarAdditionalArrow_opened]: additionalOpened,
                            })}
                        />
                    </div>
                    {additionalOpened && (
                        <>
                            <div
                                ref={additionalRef}
                                className={cn(styles.MapVehiclesSidebarAdditional)}
                            >
                                <div className={cn(styles.MapVehiclesSidebarOperatorWrapper)}>
                                    <span className={cn(styles.MapVehiclesSidebarAdditionalLabel)}>
                                        Перевозчик
                                    </span>
                                    {/* // TODO: add operators' pics */}
                                    {/* {vehicleOperator.title === 'Гортранс' && (
                                <Image src={operatorPic} layout="intrinsic" alt="Перевозчик" />
                            )} */}
                                    <div>
                                        <span
                                            className={cn(styles.MapVehiclesSidebarAdditionalTitle)}
                                        >
                                            {vehicleOperator.title}
                                        </span>
                                        {vehicleOperator.subTitle && (
                                            <>
                                                <br />
                                                <span
                                                    className={cn(
                                                        styles.MapVehiclesSidebarAdditionalSubitle,
                                                    )}
                                                >
                                                    {vehicleOperator.subTitle}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <span className={cn(styles.MapVehiclesSidebarAdditionalLabel)}>
                                        Бортномер
                                    </span>
                                    <br />
                                    <span className={cn(styles.MapVehiclesSidebarBoardId)}>
                                        {boardId}
                                    </span>
                                </div>
                                {stateNumberObject && (
                                    <div className={cn(styles.MapVehiclesSidebarLabelWrapper)}>
                                        <span
                                            className={cn(styles.MapVehiclesSidebarAdditionalLabel)}
                                        >
                                            Госномер
                                        </span>
                                        <div
                                            ref={roadNumberRef}
                                            className={cn(
                                                styles.MapVehiclesSidebarRoadNumberWrapper,
                                            )}
                                        >
                                            <div
                                                className={cn(styles.MapVehiclesSidebarRoadNumber, {
                                                    [styles.MapVehiclesSidebarRoadNumberPassenger]:
                                                        stateNumberObject.number.length === 2,
                                                })}
                                            >
                                                {stateNumberObject.number.map((part) => (
                                                    <span key={part}>{part}</span>
                                                ))}
                                            </div>
                                            <div
                                                className={cn(
                                                    styles.MapVehiclesSidebarRegionWrapper,
                                                    {
                                                        [styles.MapVehiclesSidebarRoadNumberPassenger]:
                                                            stateNumberObject.number.length === 2,
                                                    },
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        styles.MapVehiclesSidebarRegionNumber,
                                                    )}
                                                >
                                                    {stateNumberObject.region}
                                                </span>
                                                <span
                                                    className={cn(styles.MapVehiclesSidebarRegion)}
                                                >
                                                    RUS
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {unitInfo && (
                                <>
                                    <Divider />
                                    <div className={cn(styles.MapVehiclesSidebarAdditional)}>
                                        {Boolean(unitInfo?.model || unitInfo?.factory) && (
                                            <div
                                                className={cn(
                                                    styles.MapVehiclesSidebarModelWrapper,
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        styles.MapVehiclesSidebarAdditionalLabel,
                                                    )}
                                                >
                                                    Модель машины
                                                </span>
                                                {/* TODO: add models' pics */}
                                                {/* <Image src={modelPic} layout="intrinsic" alt="Модель" /> */}
                                                <div>
                                                    {unitInfo.model && (
                                                        <span
                                                            className={cn(
                                                                styles.MapVehiclesSidebarAdditionalTitle,
                                                            )}
                                                        >
                                                            {t(unitInfo.model)}
                                                        </span>
                                                    )}
                                                    {Boolean(
                                                        unitInfo.model && unitInfo.factory,
                                                    ) && <br />}
                                                    {unitInfo.factory && (
                                                        <span
                                                            className={cn(
                                                                styles.MapVehiclesSidebarAdditionalSubitle,
                                                            )}
                                                        >
                                                            {t(unitInfo.factory)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {unitInfo?.factoryNumber && (
                                            <div
                                                className={cn(
                                                    styles.MapVehiclesSidebarLabelWrapper,
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        styles.MapVehiclesSidebarAdditionalLabel,
                                                    )}
                                                >
                                                    Заводской номер
                                                </span>
                                                <span
                                                    className={cn(
                                                        styles.MapVehiclesSidebarFactoryNumber,
                                                    )}
                                                >
                                                    {unitInfo.factoryNumber}
                                                </span>
                                            </div>
                                        )}
                                        {unitInfo?.year && (
                                            <div
                                                className={cn(
                                                    styles.MapVehiclesSidebarLabelWrapper,
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        styles.MapVehiclesSidebarAdditionalLabel,
                                                    )}
                                                >
                                                    Год выпуска
                                                </span>
                                                <span
                                                    className={cn(
                                                        styles.MapVehiclesSidebarManufactureYear,
                                                    )}
                                                >
                                                    {unitInfo.year}
                                                </span>
                                                <span
                                                    className={cn(
                                                        styles.MapVehiclesSidebarManufactureYearDiff,
                                                    )}
                                                >
                                                    {`${manufactureYearDiff} ${getNoun(
                                                        manufactureYearDiff,
                                                        'год',
                                                        'года',
                                                        'лет',
                                                    )} назад`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
