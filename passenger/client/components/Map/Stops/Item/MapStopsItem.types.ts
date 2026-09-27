import L from 'leaflet';

import { StopType } from 'transport-common/types/masstrans';

export interface MapStopsItemProps {
    coords: [number, number];
    type: StopType;
    id: string;
    name: string;
    withLabel?: boolean;
}

export interface IconObject {
    idle: L.DivIcon;
    inactive: L.DivIcon;
    selected: L.DivIcon;
}
