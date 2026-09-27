import { useSyncExternalStore } from 'react';

import { loadRouteStopsRows } from 'api/ekb/domain';

import { prepareEndpoints } from './doorToDoor';
import { describePoint, isPointValue, LatLngPoint, pointValue } from './places';
import { buildGraph, Graph, MAX_RIDES, planJourneys } from './planner';
import { PlannedJourney, planSchedules } from './schedule';

/**
 * Состояние «Маршрута»: откуда, куда, найденные варианты и выбранный.
 * Откуда и куда - id остановки или место «широта,долгота» (адрес, точка на карте, где я).
 * Живёт вне React-дерева сайдбара, потому что панель пересоздаётся: из карточки остановки
 * жмут «Отсюда», потом открывают другую остановку и жмут «Сюда» - выбор должен сохраниться.
 * Линию на карте рисует MapJourneyLayer по этому же состоянию.
 */
export interface JourneyState {
    from: string | null;
    to: string | null;
    /** Подписи мест (не остановок): адрес, «Моё местоположение», «Точка на карте». */
    labels: Record<string, string>;
    /** Ждём нажатия на карту, чтобы поставить туда точку. */
    picking: 'from' | 'to' | null;
    /** Граф последнего поиска - с местами «откуда/куда», если это не остановки. */
    graph: Graph | null;
    /** Сколько пересадок допускает поиск - из настроек (MapPreferencesProvider). */
    maxTransfers: number;
    /** Навигатор по шагам выбранного варианта: номер шага (см. navigationSteps) или null - список вариантов. */
    navStep: number | null;
    status: 'idle' | 'loading' | 'done' | 'error';
    journeys: PlannedJourney[];
    selected: number;
    /** Открыта ли панель - от этого зависит, рисовать ли маршрут на карте. */
    panelOpen: boolean;
    /** Момент, на который посчитаны отправления. */
    plannedAt: number | null;
}

let state: JourneyState = {
    from: null,
    to: null,
    labels: {},
    picking: null,
    graph: null,
    maxTransfers: MAX_RIDES - 1,
    navStep: null,
    status: 'idle',
    journeys: [],
    selected: 0,
    panelOpen: false,
    plannedAt: null,
};

const listeners = new Set<() => void>();

const setState = (patch: Partial<JourneyState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const getJourneyState = () => state;

export function useJourney(): JourneyState {
    return useSyncExternalStore(subscribe, getJourneyState, getJourneyState);
}

let graphPromise: Promise<Graph> | null = null;

export function loadJourneyGraph(): Promise<Graph> {
    if (!graphPromise) {
        // Метро в Краснодаре нет (TASK-260) - граф только из наземного транспорта.
        graphPromise = loadRouteStopsRows()
            .then((rows) => buildGraph(rows, null))
            .catch((error) => {
                graphPromise = null;
                throw error;
            });
    }
    return graphPromise;
}

let requestId = 0;

async function recalculate(silent = false) {
    const { from, to } = state;
    const id = (requestId += 1);

    if (!from || !to || from === to) {
        setState({ status: 'idle', journeys: [], selected: 0, plannedAt: null });
        return;
    }

    // Тихий пересчёт (обновление отправлений раз в минуту) не прячет список и не сбрасывает выбор.
    if (!silent) setState({ status: 'loading', journeys: [], selected: 0, navStep: null });

    try {
        const base = await loadJourneyGraph();
        const { graph, fromId, toId } = await prepareEndpoints(base, from, to, state.labels);
        const itineraries = planJourneys(graph, fromId, toId, 4, state.maxTransfers + 1);
        const now = new Date();
        const journeys = await planSchedules(itineraries, now, graph);
        if (id !== requestId) return;
        const selected = silent && state.selected < journeys.length ? state.selected : 0;
        setState({ status: 'done', journeys, graph, selected, plannedAt: now.getTime() });
    } catch (error) {
        console.error('Не удалось построить маршрут', error);
        if (id === requestId && !silent) setState({ status: 'error', journeys: [] });
    }
}

const withLabel = (value: string | null, label?: string) =>
    value && label ? { ...state.labels, [value]: label } : state.labels;

export const placeLabel = (value: string, labels: Record<string, string>) =>
    labels[value] ?? 'Точка на карте';

/** Точку поставили на карте - подпишем её ближайшим адресом, когда геокодер ответит. */
function labelPoint(value: string) {
    const point = { lat: Number(value.split(',')[0]), lng: Number(value.split(',')[1]) };
    describePoint(point).then((label) => {
        if (label && !state.labels[value])
            setState({ labels: { ...state.labels, [value]: label } });
    });
}

export const journeyActions = {
    setFrom(value: string | null, label?: string) {
        setState({ from: value, labels: withLabel(value, label), picking: null });
        recalculate();
    },
    setTo(value: string | null, label?: string) {
        setState({ to: value, labels: withLabel(value, label), picking: null });
        recalculate();
    },
    setBoth(from: string | null, to: string | null, labels: Record<string, string> = {}) {
        setState({ from, to, labels: { ...state.labels, ...labels } });
        [from, to].forEach((value) => {
            if (isPointValue(value) && !state.labels[value!]) labelPoint(value!);
        });
        recalculate();
    },
    /** Поле ждёт точку с карты; повторный вызов с тем же полем - отмена. */
    startPicking(field: 'from' | 'to' | null) {
        setState({ picking: state.picking === field ? null : field });
    },
    pickPoint(point: LatLngPoint) {
        const field = state.picking;
        if (!field) return;
        const value = pointValue(point);
        setState({ [field]: value } as Partial<JourneyState>);
        // Режим выбора снимаем после всех обработчиков этого нажатия: клик по карте в
        // MapTransport закрыл бы панель, если бы увидел, что точку уже не выбирают.
        setTimeout(() => setState({ picking: null }), 0);
        labelPoint(value);
        recalculate();
    },
    swap() {
        setState({ from: state.to, to: state.from });
        recalculate();
    },
    refresh() {
        recalculate(true);
    },
    select(index: number) {
        setState({ selected: index, navStep: null });
    },
    /** Лимит пересадок поменяли в настройках - пересчитываем уже найденный маршрут. */
    setMaxTransfers(maxTransfers: number) {
        if (state.maxTransfers === maxTransfers) return;
        setState({ maxTransfers });
        if (state.from && state.to) recalculate();
    },
    /** «Поехали»: навигатор по шагам выбранного варианта. */
    startNavigation() {
        setState({ navStep: 0 });
    },
    setNavStep(step: number) {
        setState({ navStep: step });
    },
    stopNavigation() {
        setState({ navStep: null });
    },
    setPanelOpen(panelOpen: boolean) {
        if (state.panelOpen !== panelOpen)
            setState(panelOpen ? { panelOpen } : { panelOpen, picking: null, navStep: null });
    },
};
