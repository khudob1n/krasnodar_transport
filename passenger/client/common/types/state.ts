import { ClientUnit, Route, StopInfoItem, Unit } from 'transport-common/types/masstrans';
import { StrapiStop } from 'transport-common/types/strapi';

export interface State {
    publicTransport: {
        currentVehicle:
            | (Pick<Unit, 'num' | 'routeId' | 'routeDirection' | 'type'> & CurrentVehicleOptions)
            | null;
        currentStop: string | null;
        /** Последняя открытая остановка - «моя остановка» для счётчика в карточке машины
         *  (TASK-209). В отличие от currentStop, не сбрасывается при выборе машины. */
        lastStop: string | null;
        currentRoute: Route & Pick<Unit, 'type' | 'routeDirection'> & CurrentRouteOptions;
        stops: StrapiStop[];
        vehicleStops: StrapiStop['attributes']['stopId'][];
        stopVehicles: Pick<StopInfoItem, 'route' | 'type' | 'routeDirection'>[];
        stopInfo: StopInfoItem[];
        // Пустой stopInfo сам по себе неоднозначен: это и "ещё грузим", и "транспорта не
        // будет". Флаг разводит эти два состояния - см. MapStopsSidebarStopsList.
        isStopInfoLoading: boolean;
        /** requestId последнего выбора остановки / машины: ответ более раннего запроса,
         *  пришедший позже (быстро переключили или уже закрыли карточку), не применяется. */
        stopRequestId: string | null;
        vehicleRequestId: string | null;
        units: Record<ClientUnit, Unit[]>;
    };
}

export interface CurrentVehicleSettings {
    shouldFilterByRouteDirection?: boolean;
}
export type CurrentVehiclePayload = State['publicTransport']['currentVehicle'];
export interface CurrentVehicleOptions {
    shouldClear?: boolean;
    shouldFlyTo?: boolean;
    shouldFilterByRouteDirection?: boolean;
}
export type CurrentVehiclePayloadWithOptions = CurrentVehiclePayload & CurrentVehicleOptions;
export interface CurrentRouteOptions {
    shouldFlyTo?: boolean;
}
export interface SetCurrentVehiclePayload extends CurrentVehicleOptions {
    currentVehicle: CurrentVehiclePayload;
    currentRoute: State['publicTransport']['currentRoute'] & CurrentRouteOptions;
}
export type CurrentStopPayload = State['publicTransport']['currentStop'];
export interface CurrentStopOptions {
    shouldClear?: boolean;
    /** Тихое обновление открытой карточки раз в минуту - без скелетона. */
    refresh?: boolean;
}
export interface CurrentStopPayloadWithOptions extends CurrentStopOptions {
    currentStop: CurrentStopPayload;
}
export interface SetCurrentStopPayload extends CurrentStopOptions {
    currentStop: CurrentStopPayload;
    stopInfo: State['publicTransport']['stopInfo'];
}
export type SetStopsPayload = State['publicTransport']['stops'];

export type SetUnitsPayload =
    State['publicTransport']['units'][keyof State['publicTransport']['units']];
