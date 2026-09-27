import L from 'leaflet';
import classNames from 'classnames/bind';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import { ClientUnit, StopType } from 'transport-common/types/masstrans';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';

import styles from './MapStopsItem.module.css';
import { IconObject } from './MapStopsItem.types';

const cn = classNames.bind(styles);

const commonIconOptions: L.DivIconOptions = {
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -24],
    className: cn(styles.MapStopsItemIcon),
};

function stopIcon(type: ClientUnit | StopType.TrollBus, state: 'idle' | 'inactive' | 'selected') {
    return new L.DivIcon({
        ...commonIconOptions,
        html: ReactDOMServer.renderToStaticMarkup(
            React.createElement(
                'span',
                { className: cn(styles.MapStopsItemPin, styles[`MapStopsItemPin_${state}`]) },
                React.createElement(TransportIcon, { type, variant: 'stop', alt: '' }),
            ),
        ),
    });
}

const icons = {
    [ClientUnit.Bus]: {
        idle: stopIcon(ClientUnit.Bus, 'idle'),
        inactive: stopIcon(ClientUnit.Bus, 'inactive'),
        selected: stopIcon(ClientUnit.Bus, 'selected'),
    },
    [ClientUnit.Tram]: {
        idle: stopIcon(ClientUnit.Tram, 'idle'),
        inactive: stopIcon(ClientUnit.Tram, 'inactive'),
        selected: stopIcon(ClientUnit.Tram, 'selected'),
    },
    [ClientUnit.Troll]: {
        idle: stopIcon(ClientUnit.Troll, 'idle'),
        inactive: stopIcon(ClientUnit.Troll, 'inactive'),
        selected: stopIcon(ClientUnit.Troll, 'selected'),
    },
};

/** Совмещённая остановка без выбранной машины - значок, поделённый по диагонали на цвета
 *  автобуса и троллейбуса. Когда выбрана машина, остановка берёт её цвет (TROLL_BUS_ICON_BY_TYPE). */
export const TROLL_BUS_ICON: IconObject = {
    idle: stopIcon(StopType.TrollBus, 'idle'),
    inactive: stopIcon(StopType.TrollBus, 'inactive'),
    selected: stopIcon(StopType.TrollBus, 'selected'),
};

export const STOP_ICON_BY_TYPE: Record<Exclude<StopType, StopType.TrollBus>, IconObject> = {
    [StopType.Tram]: {
        ...icons[ClientUnit.Tram],
    },
    [StopType.Troll]: {
        ...icons[ClientUnit.Troll],
    },
    [StopType.Bus]: {
        ...icons[ClientUnit.Bus],
    },
} as const;

export const TROLL_BUS_ICON_BY_TYPE: Record<ClientUnit, IconObject> = {
    [ClientUnit.Troll]: {
        ...icons[ClientUnit.Troll],
    },
    [ClientUnit.Bus]: {
        ...icons[ClientUnit.Bus],
    },
    [ClientUnit.Tram]: {
        ...icons[ClientUnit.Tram],
    },
} as const;
