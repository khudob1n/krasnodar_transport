import React from 'react';

import { Typography } from 'components/UI/Typography/Typography';
import { STATION_KIND_COLORS, StationIcon } from 'components/UI/StationIcon/StationIcon';

import { RailStation, RailStationKind } from './MapRail';
import { RailSchedule } from './RailSchedule';
import { DevIds } from 'components/UI/DevIds/DevIds';
import styles from './RailSidebar.module.css';

const KIND_LABELS: Record<RailStationKind, string> = {
    railway_station: 'Железнодорожная станция',
    rail_stop: 'Пассажирская платформа',
    bus_terminal: 'Автовокзал',
    airport: 'Аэропорт',
};

export function RailSidebar({ station }: { station: RailStation }) {
    return (
        <div className={styles.RailSidebar}>
            <header className={styles.RailSidebarHeader}>
                <span
                    className={styles.RailSidebarIcon}
                    style={
                        {
                            '--StationColor': STATION_KIND_COLORS[station.kind],
                        } as React.CSSProperties
                    }
                >
                    <StationIcon kind={station.kind} alt="" />
                </span>
                <div>
                    <span>{KIND_LABELS[station.kind]}</span>
                    <Typography variant="h4">{station.name}</Typography>
                </div>
            </header>
            <div className={styles.RailSidebarContent} data-card-stagger>
                <DevIds
                    items={[
                        ['ID станции', station.id],
                        ['Код ЕСР', station.esr_code],
                    ]}
                />
                <p>{station.description}</p>
                <RailSchedule station={station} />
            </div>
        </div>
    );
}
