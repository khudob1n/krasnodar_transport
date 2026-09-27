import React from 'react';

import classNames from 'classnames/bind';

import { StopType } from 'transport-common/types/masstrans';

import { Typography } from 'components/UI/Typography/Typography';
import { IconFont } from 'components/UI/Typography/IconFont/IconFont';
import { IconFontCharsNames } from 'common/constants/iconFontChars';
import { Divider } from 'components/UI/Divider/Divider';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';
import t from 'utils/typograph';

import { MapStopsSidebarProps } from '../MapStopsSidebar';
import { MapStopsSidebarRow } from '../Row/MapStopsSidebarRow';

import styles from './MapStopsSidebarHeader.module.css';

const cn = classNames.bind(styles);

const STOP_TYPE_LABELS: Record<StopType, string> = {
    [StopType.Bus]: 'Остановка автобуса',
    [StopType.Tram]: 'Остановка трамвая',
    [StopType.Troll]: 'Остановка троллейбуса',
    [StopType.TrollBus]: 'Остановка троллейбуса и автобуса',
};

export interface MapStopsSidebarHeaderProps
    extends Pick<MapStopsSidebarProps, 'name'> {
    type: StopType;
}

export function MapStopsSidebarHeader({ type, name }: MapStopsSidebarHeaderProps) {
    const formattedName = t(name).replace(/\u00a0/g, ' ');

    return (
        <div className={cn(styles.MapStopsSidebarHeaderWrapper)}>
            <MapStopsSidebarRow mix={styles.MapStopsSidebarHeader}>
                <div className={cn(styles.MapStopsSidebarHeaderInfo)}>
                    <TransportIcon
                        type={type}
                        variant="stop"
                        className={cn(styles.MapStopsSidebarHeaderIcon)}
                        alt=""
                    />
                    <div className={cn(styles.MapStopsSidebarHeaderTitle)}>
                        {STOP_TYPE_LABELS[type] && (
                            <span className={cn(styles.MapStopsSidebarHeaderKind)}>
                                {STOP_TYPE_LABELS[type]}
                            </span>
                        )}
                        <Typography variant="h4">{formattedName}</Typography>
                    </div>
                </div>
            </MapStopsSidebarRow>
            <Divider />
        </div>
    );
}
