import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';

import { ClientUnit } from 'transport-common/types/masstrans';

import { State } from 'common/types/state';
import { VehicleUnit } from 'api/masstrans/masstrans';
import { useOpenStop } from 'components/Map/Stops/useOpenStop';
import { useOpenVehicle } from 'components/Map/Vehicles/useOpenVehicle';
import { openJourneyPanel } from 'components/Map/Journey/openJourneyPanel';
import { journeyActions } from 'services/journey/journeyStore';

/**
 * Ссылки вида /map?stop=<id>, /map?vehicle=<id> (TASK-217, кнопка «Поделиться») и
 * /map?from=<id>&to=<id> (маршрут; вместо id остановки может быть место «широта,долгота»
 * с подписью в fromName/toName). Ждёт, пока
 * загрузятся остановки или машины, открывает объект один раз и убирает параметр из адреса -
 * иначе при обновлении страницы карточка открывалась бы снова.
 */
export function MapDeepLink() {
    const handled = useRef(false);
    const target = useRef<{
        stop?: string;
        vehicle?: string;
        from?: string;
        to?: string;
        labels?: Record<string, string>;
    } | null>(null);
    const stops = useSelector((state: State) => state.publicTransport.stops);
    const units = useSelector((state: State) => state.publicTransport.units);
    const openStop = useOpenStop();
    const openVehicle = useOpenVehicle();

    if (target.current === null && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        target.current = {
            stop: params.get('stop') ?? undefined,
            vehicle: params.get('vehicle') ?? undefined,
            from: params.get('from') ?? undefined,
            to: params.get('to') ?? undefined,
            labels: Object.fromEntries(
                (['from', 'to'] as const)
                    .map((field) => [params.get(field), params.get(`${field}Name`)])
                    .filter((pair): pair is [string, string] => Boolean(pair[0] && pair[1])),
            ),
        };
    }

    useEffect(() => {
        const { stop, vehicle, from, to, labels } = target.current ?? {};
        if (handled.current || (!stop && !vehicle && !from && !to)) return;

        let done = false;

        // Маршрут ждёт остановок: без них в полях не показать названия.
        if ((from || to) && stops?.length) {
            journeyActions.setBoth(from ?? null, to ?? null, labels);
            openJourneyPanel();
            done = true;
        }

        if (stop && stops?.length) {
            done = openStop(stop) || true;
        }

        if (vehicle) {
            const all = [
                ...(units[ClientUnit.Bus] ?? []),
                ...(units[ClientUnit.Troll] ?? []),
                ...(units[ClientUnit.Tram] ?? []),
            ];
            const found = all.find((unit) => unit.id === vehicle) as VehicleUnit | undefined;

            if (found) {
                openVehicle(found, { flyTo: true });
            }

            // Машины загрузились, а нужной нет (закончила смену) - больше не ждём.
            if (all.length) done = true;
        }

        if (done) {
            handled.current = true;
            const url = new URL(window.location.href);
            url.searchParams.delete('stop');
            url.searchParams.delete('vehicle');
            url.searchParams.delete('from');
            url.searchParams.delete('to');
            url.searchParams.delete('fromName');
            url.searchParams.delete('toName');
            window.history.replaceState(window.history.state, '', url.toString());
        }
    }, [stops, units, openStop, openVehicle]);

    return null;
}
