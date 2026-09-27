import React, { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';
import { useSelector } from 'react-redux';

import { ClientUnit } from 'transport-common/types/masstrans';

import { VEHICLE_TYPE_COLORS } from 'common/constants/colors';
import { State } from 'common/types/state';
import { massTransApi } from 'api/masstrans/masstrans';
import { useMapPreferences } from 'components/MapPreferencesProvider';

type Line = { key: string; type: ClientUnit; positions: [number, number][] };

/**
 * Маршруты выбранной остановки (TASK-213): пока открыта карточка остановки, на карте бледно
 * нарисованы линии всех маршрутов, которые через неё проходят, - в том направлении, в котором
 * они идут через эту остановку. Как только выбирают конкретный рейс, остаётся только его яркая
 * линия (MapRoutes).
 */
export function MapStopRoutes() {
    const currentStop = useSelector((state: State) => state.publicTransport.currentStop);
    const stopInfo = useSelector((state: State) => state.publicTransport.stopInfo);
    const currentVehicle = useSelector((state: State) => state.publicTransport.currentVehicle);
    const { layers } = useMapPreferences();
    const [lines, setLines] = useState<Line[]>([]);

    useEffect(() => {
        if (!currentStop || !stopInfo?.length) {
            setLines([]);
            return undefined;
        }

        let active = true;
        const unique = new Map<string, { routeId: number; routeDirection: string; type: ClientUnit }>();

        stopInfo.forEach(({ routeId, routeDirection, type }) => {
            if (routeId) unique.set(`${routeId}:${routeDirection}`, { routeId, routeDirection, type });
        });

        Promise.all(
            Array.from(unique.entries()).map(async ([key, { routeId, routeDirection, type }]) => {
                const route = await massTransApi.getRoute(routeId);
                const race = route?.races.find((item) => item.raceType === routeDirection);

                return race?.coordsList?.length ? { key, type, positions: race.coordsList } : null;
            }),
        ).then((result) => {
            if (active) setLines(result.filter(Boolean));
        });

        return () => {
            active = false;
        };
    }, [currentStop, stopInfo]);

    if (currentVehicle || !lines.length) return null;

    return (
        <>
            {lines
                .filter((line) => layers[line.type])
                .map((line) => (
                    <Polyline
                        key={line.key}
                        positions={line.positions}
                        interactive={false}
                        pathOptions={{
                            color: VEHICLE_TYPE_COLORS[line.type],
                            weight: 4,
                            opacity: 0.35,
                        }}
                    />
                ))}
        </>
    );
}
