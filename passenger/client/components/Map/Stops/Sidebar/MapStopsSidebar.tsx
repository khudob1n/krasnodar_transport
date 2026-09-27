import React, { useMemo } from 'react';
import classNames from 'classnames/bind';

import { StopType } from 'transport-common/types/masstrans';
import t from 'utils/typograph';

import styles from './MapStopsSidebar.module.css';
import { MapStopsSidebarHeader } from './Header/MapStopsSidebarHeader';
import { DevIds } from 'components/UI/DevIds/DevIds';
import { useDevSettings } from 'components/DevSettingsProvider';
import { MapStopsSidebarRow } from './Row/MapStopsSidebarRow';
import { MapStopsSidebarStopsList } from './StopsList/MapStopsSidebarStopsList';

export type MapStopsSidebarProps = {
    type: StopType;
    name: string;
    stopId: string;
};

const cn = classNames.bind(styles);

// Строка с ID показывается только при включённом тумблере в настройках - иначе DevIds
// ничего не рисует, и пустая строка с отступами не нужна.
function DevIdsRow({ stopId }: { stopId: string }) {
    const { showIds } = useDevSettings();
    if (!showIds) return null;
    return (
        <MapStopsSidebarRow mix={styles.MapStopsSidebarDevIds}>
            <DevIds items={[['ID остановки', stopId]]} />
        </MapStopsSidebarRow>
    );
}

export function MapStopsSidebar({ type, name, stopId }: MapStopsSidebarProps) {
    return (
        <div className={cn(styles.MapStopsSidebar)}>
            <MapStopsSidebarHeader name={t(name)} type={type} />
            <DevIdsRow stopId={stopId} />
            <MapStopsSidebarStopsList stopId={stopId} />
        </div>
    );
}
