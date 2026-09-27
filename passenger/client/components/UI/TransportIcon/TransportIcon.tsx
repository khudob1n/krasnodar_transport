import React from 'react';
import { ClientUnit, StopType } from 'transport-common/types/masstrans';

import BusIcon from '@rapideditor/temaki/icons/bus.svg';
import TramIcon from '@rapideditor/temaki/icons/tram.svg';
import TrolleybusIcon from '@rapideditor/temaki/icons/trolleybus.svg';
import TrainDieselIcon from '@rapideditor/temaki/icons/train_diesel.svg';
import BoardBusIcon from '@rapideditor/temaki/icons/board_bus.svg';
import BoardTramIcon from '@rapideditor/temaki/icons/board_tram.svg';
import BoardTrainDieselIcon from '@rapideditor/temaki/icons/board_train_diesel.svg';

import { VEHICLE_TYPE_COLORS } from 'common/constants/colors';

type TransportType = ClientUnit | StopType | 'train';

export interface TransportIconProps extends React.SVGProps<SVGSVGElement> {
    type: TransportType;
    alt?: string;
    variant?: 'vehicle' | 'stop';
}

const ICON_BY_TYPE = {
    [ClientUnit.Bus]: BusIcon,
    [ClientUnit.Tram]: TramIcon,
    [ClientUnit.Troll]: TrolleybusIcon,
    [StopType.TrollBus]: TrolleybusIcon,
    train: TrainDieselIcon,
};

const STOP_ICON_BY_TYPE = {
    [ClientUnit.Bus]: BoardBusIcon,
    [ClientUnit.Troll]: BoardBusIcon,
    [ClientUnit.Tram]: BoardTramIcon,
    train: BoardTrainDieselIcon,
};

/** Единая точка подключения транспортных пиктограмм Temaki. */
export function TransportIcon({
    type,
    variant = 'vehicle',
    alt = '',
    style,
    ...props
}: TransportIconProps) {
    const a11y = {
        'aria-hidden': alt ? undefined : true,
        'aria-label': alt || undefined,
        role: alt ? 'img' : undefined,
    } as const;

    // Совмещённая остановка автобуса и троллейбуса: значок делится по диагонали - левая
    // верхняя половина цвета автобуса, правая нижняя - троллейбуса. Половины - две копии
    // пиктограммы, обрезанные clip-path в координатах viewBox: без <clipPath id=...>, поэтому
    // одинаковые id не конфликтуют, когда значок на странице десятки раз (маркеры карты).
    if (variant === 'stop' && type === StopType.TrollBus) {
        return (
            <svg viewBox="0 0 15 15" {...props} style={style} {...a11y}>
                <g style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%) view-box' }}>
                    <BoardBusIcon width="15" height="15" style={{ fill: VEHICLE_TYPE_COLORS[ClientUnit.Bus] }} />
                </g>
                <g style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%) view-box' }}>
                    <BoardBusIcon width="15" height="15" style={{ fill: VEHICLE_TYPE_COLORS[ClientUnit.Troll] }} />
                </g>
            </svg>
        );
    }

    const Icon = (variant === 'stop' ? STOP_ICON_BY_TYPE : ICON_BY_TYPE)[type];
    const colorType = type === StopType.TrollBus ? ClientUnit.Troll : type;
    const color = colorType === 'train' ? 'var(--train)' : VEHICLE_TYPE_COLORS[colorType];

    return (
        <Icon
            {...props}
            style={{ fill: color, ...style }}
            {...a11y}
        />
    );
}
