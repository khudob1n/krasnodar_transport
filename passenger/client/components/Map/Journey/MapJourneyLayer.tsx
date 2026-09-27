import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, Marker, Pane, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { massTransApi } from 'api/masstrans/masstrans';
import { journeyActions, useJourney } from 'services/journey/journeyStore';
import { walkTarget } from 'services/journey/doorToDoor';
import { fetchWalkRoute } from 'services/journey/places';
import { Graph, isMetroStop } from 'services/journey/planner';
import { navigationSteps } from 'services/journey/steps';
import { sidebarPadding } from 'components/Map/mapViewport';
import { useMapPreferences } from 'components/MapPreferencesProvider';
import { PlannedJourney } from 'services/journey/schedule';

import { journeyModeColor } from './JourneyRouteChip';

type LatLng = [number, number];

type Segment =
    | { kind: 'ride'; color: string; positions: LatLng[] }
    | { kind: 'walk'; positions: LatLng[] };

const WALK_COLOR = '#55647D';
/** Насколько можно отдалить карту, чтобы показать маршрут целиком. */
const JOURNEY_MIN_ZOOM = 11;

/** Ближайшая к point точка на отрезках линии, начиная с отрезка fromSegment и не раньше доли fromT. */
function projectOnLine(line: LatLng[], point: LatLng, fromSegment = 0, fromT = 0) {
    // Плоское приближение: градус долготы на широте Краснодара (45°) ~0.71 градуса широты.
    const x = (p: LatLng) => p[1] * 0.71;
    let best = { segment: fromSegment, t: fromT, point: line[fromSegment], distance: Infinity };
    for (let i = fromSegment; i < line.length - 1; i += 1) {
        const [a, b] = [line[i], line[i + 1]];
        const dx = x(b) - x(a);
        const dy = b[0] - a[0];
        const length = dx * dx + dy * dy;
        let t = length ? ((x(point) - x(a)) * dx + (point[0] - a[0]) * dy) / length : 0;
        t = Math.min(1, Math.max(i === fromSegment ? fromT : 0, t));
        const projected: LatLng = [a[0] + dy * t, a[1] + (b[1] - a[1]) * t];
        const distance = (projected[0] - point[0]) ** 2 + (x(projected) - x(point)) ** 2;
        if (distance < best.distance) best = { segment: i, t, point: projected, distance };
    }
    return best;
}

/**
 * Кусок линии маршрута между первой и последней остановкой поездки. Режем по проекции
 * остановки на отрезок, а не по ближайшей вершине: на длинных прямых вершины редкие, и линия
 * проезжала мимо остановки до следующей вершины и возвращалась «шипом». Остановки проходим
 * по порядку - на кольцевых маршрутах трасса бывает рядом с одной точкой дважды.
 * Нет геометрии - ломаная по остановкам.
 */
function sliceLine(line: LatLng[] | undefined, stops: LatLng[]): LatLng[] {
    if (!line || line.length < 2) return stops;
    const first = projectOnLine(line, stops[0]);
    let cursor = first;
    stops.slice(1).forEach((stop) => {
        cursor = projectOnLine(line, stop, cursor.segment, cursor.t);
    });
    const last = cursor;
    if (last.segment === first.segment && last.t <= first.t) return stops;
    const middle = line.slice(first.segment + 1, last.segment + 1);
    return [stops[0], first.point, ...middle, last.point, stops[stops.length - 1]];
}

async function buildSegments(journey: PlannedJourney, graph: Graph): Promise<Segment[]> {
    const coordsOf = (id: number): LatLng => {
        const stop = graph.stops.get(id);
        return stop ? [stop.lat, stop.lng] : [0, 0];
    };

    return Promise.all(
        journey.legs.map(async (leg): Promise<Segment> => {
            if (leg.kind === 'walk') {
                // У метро идём к ближайшему входу, а не к центру станции.
                const fromStop = graph.stops.get(leg.from);
                const toStop = graph.stops.get(leg.to);
                if (!fromStop || !toStop) return { kind: 'walk', positions: [] };
                const start = isMetroStop(leg.from)
                    ? walkTarget(graph, leg.from, toStop)
                    : fromStop;
                const end = isMetroStop(leg.to) ? walkTarget(graph, leg.to, fromStop) : toStop;
                if (!start || !end) return { kind: 'walk', positions: [] };
                // Концы - сама точка или вход в метро (не центр станции): OSRM начинает путь с
                // ближайшей дороги, до точки дорисовываем.
                const ends: LatLng[] = [
                    [start.lat, start.lng],
                    [end.lat, end.lng],
                ];
                const route = await fetchWalkRoute(start, end);
                // От входа до станции под землёй улиц нет - прямая до её центра.
                const toPlatform: LatLng[] = isMetroStop(leg.to) ? [coordsOf(leg.to)] : [];
                const fromPlatform: LatLng[] = isMetroStop(leg.from) ? [coordsOf(leg.from)] : [];
                return {
                    kind: 'walk',
                    positions: [
                        ...fromPlatform,
                        ...(route ? [ends[0], ...route.positions, ends[1]] : ends),
                        ...toPlatform,
                    ],
                };
            }

            const pattern = leg.chosen;
            const stops = pattern.stops
                .slice(leg.chosenBoardIndex, leg.chosenAlightIndex + 1)
                .map(coordsOf);
            // У метро в данных нет геометрии - ломаная по станциям.
            if (pattern.type === 'metro') {
                return {
                    kind: 'ride',
                    color: journeyModeColor(pattern.type, graph.metro?.color),
                    positions: stops,
                };
            }

            const route = await massTransApi.getRoute(pattern.routeId);
            const race = route?.races.find((item) => item.raceType === String(pattern.subrouteId));

            return {
                kind: 'ride',
                color: journeyModeColor(pattern.type, graph.metro?.color),
                positions: sliceLine(race?.coordsList as LatLng[] | undefined, stops),
            };
        }),
    );
}

const pointIcon = (letter: 'A' | 'B') =>
    L.divIcon({
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / 35%);background:${
            letter === 'A' ? '#2e7d32' : '#d32f2f'
        };color:#fff;font:700 13px/1 Onest, sans-serif">${letter}</div>`,
    });

/** Пока поле «Откуда» или «Куда» ждёт точку с карты - нажатие по карте ставит её. */
function JourneyPointPicker() {
    const { picking } = useJourney();
    const map = useMapEvents({
        click(event) {
            if (picking) journeyActions.pickPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
        },
    });

    useEffect(() => {
        const container = map.getContainer();
        container.style.cursor = picking ? 'crosshair' : '';
        return () => {
            container.style.cursor = '';
        };
    }, [map, picking]);

    return null;
}

/**
 * Выбранный вариант маршрута на карте, пока открыта панель «Маршрут»: поездки - кусками
 * линий маршрутов в цвете вида транспорта, пешие переходы - пунктиром, пересадки - кружками.
 */
export function MapJourneyLayer() {
    const map = useMap();
    // Лимит пересадок из настроек - в состояние маршрута. Здесь, а не в панели: слой на карте
    // есть всегда, и настройку подхватит даже поиск, начатый из карточки остановки.
    const { maxTransfers } = useMapPreferences();
    useEffect(() => journeyActions.setMaxTransfers(maxTransfers), [maxTransfers]);
    const {
        journeys,
        selected,
        panelOpen,
        status,
        graph: journeyGraph,
        from,
        to,
        navStep,
    } = useJourney();
    const journey = panelOpen && status === 'done' ? journeys[selected] : undefined;
    // Навигатор: индекс этапа в journey.legs, null - шаг «вы на месте», undefined - не в навигаторе.
    const navLeg = (() => {
        if (!journey || navStep === null) return undefined;
        const steps = navigationSteps(journey);
        return steps[Math.min(navStep, steps.length - 1)];
    })();
    const [segments, setSegments] = useState<Segment[]>([]);
    const [graph, setGraph] = useState<Graph | null>(null);
    const baseMinZoom = useRef<number | null>(null);
    const pointMarkers = useRef<(L.Marker | null)[]>([]);

    // Метки A и B, добавленные посреди перелёта карты, остаются на координатах промежуточного
    // кадра - после перелёта ставим их заново.
    useMapEvents({
        moveend() {
            pointMarkers.current.forEach((marker) => marker?.setLatLng(marker.getLatLng()));
        },
    });

    // Панель закрыли - возвращаем карте её обычный минимальный масштаб.
    useEffect(() => {
        if (journey || baseMinZoom.current === null) return;
        const restored = baseMinZoom.current;
        baseMinZoom.current = null;
        if (map.getZoom() < restored) map.setZoom(restored);
        map.setMinZoom(restored);
    }, [journey, map]);

    useEffect(() => {
        if (!journey) {
            setSegments([]);
            return undefined;
        }

        let active = true;
        Promise.resolve(journeyGraph)
            .then(async (loaded) => {
                if (!loaded) return;
                const result = await buildSegments(journey, loaded);
                if (!active) return;
                setGraph(loaded);
                setSegments(result);

                const points = result.flatMap((segment) => segment.positions);
                if (points.length) {
                    const { paddingTopLeft, paddingBottomRight } = sidebarPadding(map);
                    const bounds = L.latLngBounds(points);

                    // Карта не отдаляется дальше 13-го масштаба, а маршрут через весь город с
                    // панелью сбоку туда не помещается - на время показа маршрута разрешаем
                    // отдалиться сильнее, после закрытия панели ограничение вернётся.
                    // getBoundsZoom обрезает результат по текущему minZoom - считаем при
                    // временно сниженном, иначе «не помещается» никогда не видно.
                    const base = baseMinZoom.current ?? map.getMinZoom();
                    map.options.minZoom = JOURNEY_MIN_ZOOM;
                    const needed = map.getBoundsZoom(
                        bounds,
                        false,
                        paddingTopLeft.add(paddingBottomRight),
                    );
                    if (needed < base) {
                        baseMinZoom.current = base;
                        map.setMinZoom(Math.max(JOURNEY_MIN_ZOOM, Math.floor(needed)));
                    } else {
                        map.options.minZoom = base;
                    }

                    // После того как React добавит линию и метки на карту.
                    setTimeout(() => {
                        if (!active) return;
                        map.flyToBounds(bounds, {
                            paddingTopLeft,
                            paddingBottomRight,
                            maxZoom: 16,
                            duration: 0.6,
                        });
                    }, 0);
                }
            })
            .catch((error) => console.warn('Не удалось нарисовать маршрут', error));

        return () => {
            active = false;
        };
        // Пересчёт отправлений раз в минуту создаёт новый объект того же варианта - перелетать
        // заново не нужно, достаточно сравнить по составу.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        journey &&
            journey.legs
                .map((leg) =>
                    leg.kind === 'ride'
                        ? `${leg.chosen.subrouteId}:${leg.from}-${leg.to}`
                        : `w${leg.from}-${leg.to}`,
                )
                .join('|'),
        // Точку на карте передвинули - остановки те же, а пешие куски другие.
        from,
        to,
        map,
    ]);

    // Шаг навигатора - крупно его этап; вышли из навигатора - снова весь маршрут.
    // fitBounds с анимацией, а не flyToBounds: перелёт перерисовывает векторную подложку и все
    // маркеры на каждом кадре и на ноутбуке шёл рывками. Здесь масштаб меняется CSS-анимацией
    // готовой картинки (перерисовка - одна, в конце), сдвиг - плавной прокруткой. Этапы рядом
    // друг с другом, дальний перелёт тут не нужен.
    const wasNavigating = useRef(false);
    useEffect(() => {
        if (!journey || !segments.length || !graph) return;
        const { paddingTopLeft, paddingBottomRight } = sidebarPadding(map);
        const options = { paddingTopLeft, paddingBottomRight, animate: true, duration: 0.4 };

        if (navLeg === undefined) {
            if (!wasNavigating.current) return;
            wasNavigating.current = false;
            const all = segments.flatMap((segment) => segment.positions);
            if (all.length) map.fitBounds(L.latLngBounds(all), { ...options, maxZoom: 16 });
            return;
        }

        wasNavigating.current = true;
        const last = graph.stops.get(journey.legs[journey.legs.length - 1].to);
        const points =
            navLeg === null
                ? last
                    ? [[last.lat, last.lng] as LatLng]
                    : []
                : segments[navLeg]?.positions;
        if (points?.length) map.fitBounds(L.latLngBounds(points), { ...options, maxZoom: 17 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navLeg, segments, map]);

    // В навигаторе остальные этапы приглушены, текущий - как обычно.
    const dim = (index: number) => navLeg !== undefined && navLeg !== index;

    const transfers = useMemo(() => {
        if (!journey || !graph) return [];
        return journey.legs
            .filter((leg) => leg.kind === 'ride')
            .flatMap((leg) => [leg.from, leg.to])
            .map((id) => graph.stops.get(id))
            .filter(Boolean)
            .map((stop) => [stop!.lat, stop!.lng] as LatLng);
    }, [journey, graph]);

    if (!journey || !segments.length || !graph) return <JourneyPointPicker />;

    const start = graph.stops.get(journey.legs[0].from);
    const finish = graph.stops.get(journey.legs[journey.legs.length - 1].to);

    return (
        <>
            <JourneyPointPicker />
            <Pane name="journey" style={{ zIndex: 450 }}>
                {segments.map((segment, index) =>
                    segment.kind === 'walk' ? (
                        <Polyline
                            key={index}
                            positions={segment.positions}
                            interactive={false}
                            pathOptions={{
                                color: WALK_COLOR,
                                weight: 4,
                                dashArray: '2 8',
                                lineCap: 'round',
                                opacity: dim(index) ? 0.3 : 1,
                            }}
                        />
                    ) : (
                        <React.Fragment key={index}>
                            {/* Белая подложка отделяет линию маршрута от линий улиц и других маршрутов. */}
                            <Polyline
                                positions={segment.positions}
                                interactive={false}
                                pathOptions={{
                                    color: '#fff',
                                    weight: 10,
                                    opacity: dim(index) ? 0.3 : 0.9,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                }}
                            />
                            <Polyline
                                positions={segment.positions}
                                interactive={false}
                                pathOptions={{
                                    color: segment.color,
                                    weight: 6,
                                    opacity: dim(index) ? 0.3 : 1,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                }}
                            />
                        </React.Fragment>
                    ),
                )}
                {transfers.map((position, index) => (
                    <CircleMarker
                        key={`t${index}`}
                        center={position}
                        radius={6}
                        interactive={false}
                        pathOptions={{
                            color: '#1E2841',
                            weight: 3,
                            fillColor: '#fff',
                            fillOpacity: 1,
                        }}
                    />
                ))}
            </Pane>
            {/* Метки A и B - в слое маркеров, поверх значков остановок. */}
            {start && (
                <Marker
                    ref={(marker) => {
                        pointMarkers.current[0] = marker;
                    }}
                    position={[start.lat, start.lng]}
                    icon={pointIcon('A')}
                    interactive={false}
                    zIndexOffset={1000}
                />
            )}
            {finish && (
                <Marker
                    ref={(marker) => {
                        pointMarkers.current[1] = marker;
                    }}
                    position={[finish.lat, finish.lng]}
                    icon={pointIcon('B')}
                    interactive={false}
                    zIndexOffset={1000}
                />
            )}
        </>
    );
}
