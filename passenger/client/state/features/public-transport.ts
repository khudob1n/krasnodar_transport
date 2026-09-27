import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { uniqBy } from 'lodash';

import { ClientUnit } from 'transport-common/types/masstrans';
import { massTransApi } from 'api/masstrans/masstrans';
import {
    SetCurrentStopPayload,
    SetCurrentVehiclePayload,
    SetStopsPayload,
    State,
    CurrentVehiclePayloadWithOptions,
    CurrentVehiclePayload,
    CurrentStopPayloadWithOptions,
    SetUnitsPayload,
} from 'common/types/state';

import { initialState } from '../constants/public-transport';

const SLICE_NAME = 'publicTransport';

function isCurrentVehiclePayload(obj: unknown): obj is CurrentVehiclePayload {
    return Boolean(
        (obj as CurrentVehiclePayload).num &&
            (obj as CurrentVehiclePayload).routeId &&
            (obj as CurrentVehiclePayload).routeDirection &&
            (obj as CurrentVehiclePayload).type,
    );
}

export const setCurrentVehicle = createAsyncThunk(
    `${SLICE_NAME}/setCurrentVehicle`,
    async (
        currentVehiclePayload: CurrentVehiclePayloadWithOptions,
    ): Promise<SetCurrentVehiclePayload> => {
        const {
            shouldClear = true,
            shouldFlyTo = false,
            shouldFilterByRouteDirection = false,
            ...currentVehicle
        } = currentVehiclePayload || {};

        if (!isCurrentVehiclePayload(currentVehicle)) {
            return {
                currentVehicle: null,
                currentRoute: null,
                shouldClear,
            };
        }

        const { routeId } = currentVehicle;

        const route = await massTransApi.getRoute(routeId);

        // getRoute() возвращает null при ошибке сети/данных (см. api/masstrans/masstrans.ts).
        // Раньше null спредился в объект вида {type, routeDirection, shouldFlyTo} - тот truthy
        // и без поля races, из-за чего фолбэк "if (!currentRoute)" в fulfilled ниже не срабатывал
        // и currentRoute.races.find(...) падал. Явно пробрасываем null дальше.
        if (!route) {
            return {
                currentVehicle,
                currentRoute: null,
                shouldClear,
                shouldFilterByRouteDirection,
            };
        }

        return {
            currentVehicle,
            currentRoute: {
                ...route,
                type: currentVehicle.type,
                routeDirection: currentVehicle.routeDirection,
                shouldFlyTo,
            },
            shouldClear,
            shouldFilterByRouteDirection,
        };
    },
);

export const setCurrentStop = createAsyncThunk(
    `${SLICE_NAME}/setCurrentStop`,
    async (currentStopPayload: CurrentStopPayloadWithOptions): Promise<SetCurrentStopPayload> => {
        // currentStop = null задаётся дефолтом явно: часть вызывающего кода делает
        // dispatch(setCurrentStop(null)) (весь payload null), и без дефолта деструктуризация
        // даёт currentStop === undefined, а не null. Дальше в редьюсере (ниже)
        // state.currentStop = undefined, а MapStopsItem сравнивает через
        // "currentStop !== null" - undefined проходит эту проверку как true, и все остановки
        // на карте считаются "есть активная, но не эта" (гаснут и теряют подписи).
        const { currentStop = null, shouldClear = true } = currentStopPayload || {};

        if (!currentStop) {
            return {
                currentStop,
                stopInfo: [],
                shouldClear,
            };
        }

        const stopInfo = await massTransApi.getStopInfo(currentStop);

        return {
            currentStop,
            stopInfo,
            shouldClear,
        };
    },
);

const publicTransportSlice = createSlice({
    name: SLICE_NAME,
    initialState,
    reducers: {
        setStops(state: State['publicTransport'], action: PayloadAction<SetStopsPayload>) {
            const stops = action.payload;

            state.stops = stops;
        },
        clearCurrent(state: State['publicTransport']) {
            state.currentStop = null;
            state.currentVehicle = null;
            state.currentRoute = null;

            state.stopInfo = [];
            state.isStopInfoLoading = false;
            state.stopVehicles = [];
            state.vehicleStops = [];
            // Ещё не пришедшие ответы на выбор остановки/машины уже не нужны.
            state.stopRequestId = null;
            state.vehicleRequestId = null;
        },
        setTrolls(state: State['publicTransport'], action: PayloadAction<SetUnitsPayload>) {
            const trolls = action.payload;

            state.units[ClientUnit.Troll] = trolls;
        },
        setTrams(state: State['publicTransport'], action: PayloadAction<SetUnitsPayload>) {
            const trams = action.payload;

            state.units[ClientUnit.Tram] = trams;
        },
        setBuses(state: State['publicTransport'], action: PayloadAction<SetUnitsPayload>) {
            const buses = action.payload;

            state.units[ClientUnit.Bus] = buses;
        },
    },
    extraReducers: (builder) => {
        // Ответы применяются только на последний запрос: выбрали машину А, сразу Б - если
        // маршрут А загрузится позже, он не должен подменить Б (то же у остановок ниже).
        builder.addCase(setCurrentVehicle.pending, (state, action) => {
            state.vehicleRequestId = action.meta.requestId;
        });

        builder.addCase(setCurrentVehicle.fulfilled, (state, action) => {
            if (action.meta.requestId !== state.vehicleRequestId) return;
            const { currentVehicle, currentRoute, shouldClear, shouldFilterByRouteDirection } =
                action.payload;

            state.currentVehicle = currentVehicle;
            if (state.currentVehicle) {
                state.currentVehicle.shouldFilterByRouteDirection = shouldFilterByRouteDirection;
            }

            state.currentRoute = currentRoute;

            if (!currentRoute) {
                state.vehicleStops = [];

                return;
            }

            if (!shouldClear) {
                return;
            }

            state.currentStop = null;
            state.stopInfo = [];
            state.stopVehicles = [];

            const racesInDirection = currentRoute.races.find(
                (race) => race.raceType === currentVehicle.routeDirection,
            );
            const vehicleStops = racesInDirection?.stops.map((stop) => stop.stopId) || [];

            state.vehicleStops = vehicleStops;
        });

        // У setCurrentStop есть rejected-обработчик (ниже), у setCurrentVehicle его не было
        // вообще: непойманное исключение в thunk'е (например, сбой сети внутри getRoute)
        // молча оставляло стор как есть, без отката isVehicleLoading-подобного состояния и
        // без единого следа в консоли, кроме дефолтного console.error redux-toolkit.
        builder.addCase(setCurrentVehicle.rejected, (state, action) => {
            console.error('[setCurrentVehicle]', action.error);
        });

        // Флаг ставим только для реального выбора остановки: тем же thunk'ом со значением null
        // сайдбар закрывается, и скелетон на закрытии показывать незачем.
        builder.addCase(setCurrentStop.pending, (state, action) => {
            state.stopRequestId = action.meta.requestId;
            state.isStopInfoLoading =
                Boolean(action.meta.arg?.currentStop) && !action.meta.arg?.refresh;
        });

        builder.addCase(setCurrentStop.rejected, (state, action) => {
            if (action.meta.requestId !== state.stopRequestId) return;
            state.isStopInfoLoading = false;
        });

        builder.addCase(setCurrentStop.fulfilled, (state, action) => {
            if (action.meta.requestId !== state.stopRequestId) return;
            const { currentStop, stopInfo, shouldClear } = action.payload;

            state.isStopInfoLoading = false;

            // uniq() из lodash сравнивает объекты по ссылке (SameValueZero), а .map() выше
            // создаёт новый объект на каждый элемент - ничего не дедуплицировалось: в
            // stopVehicles попадал дубль на каждый рейс расписания одного направления.
            // uniqBy с составным ключом схлопывает их по смыслу.
            const stopVehicles = uniqBy(
                stopInfo?.map((info) => ({
                    route: info.route,
                    type: info.type,
                    routeDirection: info.routeDirection,
                })) || [],
                (vehicle) => `${vehicle.route}-${vehicle.type}-${vehicle.routeDirection}`,
            );

            state.currentStop = currentStop;
            if (currentStop) state.lastStop = currentStop;
            state.stopInfo = stopInfo;
            state.stopVehicles = stopVehicles;

            if (!shouldClear) {
                return;
            }

            state.currentVehicle = null;
            state.currentRoute = null;
            state.vehicleStops = [];
        });
    },
});

export const { clearCurrent, setStops, setBuses, setTrams, setTrolls } =
    publicTransportSlice.actions;

export const publicTransportReducer = publicTransportSlice.reducer;
