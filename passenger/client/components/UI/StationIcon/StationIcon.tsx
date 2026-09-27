import React from 'react';

import AirportIcon from '@rapideditor/temaki/icons/airport.svg';
import BoardBusIcon from '@rapideditor/temaki/icons/board_bus.svg';
import BoardTrainDieselIcon from '@rapideditor/temaki/icons/board_train_diesel.svg';

import type { RailStationKind } from 'components/Map/Rail/MapRail';

export interface StationIconProps extends React.SVGProps<SVGSVGElement> {
    kind: RailStationKind;
    alt?: string;
}

const ICON_BY_KIND = {
    railway_station: BoardTrainDieselIcon,
    rail_stop: BoardTrainDieselIcon,
    bus_terminal: BoardBusIcon,
    airport: AirportIcon,
} as const;

export const STATION_KIND_COLORS = {
    railway_station: 'var(--train)',
    rail_stop: 'var(--train)',
    bus_terminal: 'var(--bus-terminal)',
    airport: '#2673c9',
} as const;

export function StationIcon({ kind, alt = '', style, ...props }: StationIconProps) {
    const Icon = ICON_BY_KIND[kind];

    return (
        <Icon
            {...props}
            style={{ fill: STATION_KIND_COLORS[kind], ...style }}
            aria-hidden={alt ? undefined : true}
            aria-label={alt || undefined}
            role={alt ? 'img' : undefined}
        />
    );
}
