import React, { Component, createRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import { connect } from 'react-redux';
import { isEqual } from 'lodash';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import classNames from 'classnames/bind';

import { withMap } from 'components/Map/hocs/withMap';
import { setCurrentVehicle } from 'state/features/public-transport';
import { State } from 'common/types/state';
import { sidebarService } from 'services/sidebar/sidebar';

import { MapVehicleMarker } from '../Marker/MapVehicleMarker';
import { isStale } from '../staleness';
import { MapVehiclesSidebar, MapVehiclesSidebarProps } from '../Sidebar/MapVehiclesSidebar';

import { commitMoveOffset, startMoveInDirection, stopMoveInterval } from './MapVehiclesItem.utils';
import { EAST_COURSE_RANGE } from './MapVehiclesItem.constants';
import { MapVehiclesItemProps } from './MapVehiclesItem.types';

import styles from './MapVehiclesItem.module.css';

const cn = classNames.bind(styles);

export class MapVehiclesItemComponent extends Component<MapVehiclesItemProps> {
    private icon: L.DivIcon;

    private markerRef = createRef<L.Marker>();

    // Штриховка зашита в html иконки, поэтому при смене «свежая/устаревшая» иконку пересобираем.
    private stale = false;

    constructor(props: MapVehiclesItemProps) {
        super(props);

        this.icon = this.getIcon();
    }

    componentDidMount(): void {
        setTimeout(() => this.updateTranslate(true), 0);

        const { map } = this.props;

        map.addEventListener('zoomstart', this.onZoomStart);
        map.addEventListener('zoomend', this.onZoomEnd);
    }

    componentDidUpdate(prevProps: Readonly<MapVehiclesItemProps>): void {
        const { course, coords, speed } = this.props;
        const coordsChanged = !isEqual(prevProps.coords, coords);
        const motionChanged = prevProps.course !== course || prevProps.speed !== speed;

        if (!coordsChanged && motionChanged) {
            this.commitTranslate();
        }

        if (prevProps.course !== course || isStale(this.props.navTime) !== this.stale) {
            this.markerRef.current?.setIcon(this.getIcon());
        }

        if (coordsChanged) setTimeout(() => this.updateTranslate(true), 0);
        else if (motionChanged) setTimeout(() => this.updateTranslate(false), 0);
    }

    componentWillUnmount(): void {
        const { map, id, num } = this.props;

        // Симметрично componentDidMount: без этого каждый смонтированный за сессию маркер
        // навсегда оставлял на карте свой обработчик zoomend (маркеры пересоздаются постоянно -
        // фильтрация по bounds на каждый moveend, прореживание при зуме, обновление списка
        // машин раз в 30с), и каждый лишний обработчик ставил setTimeout на уже размонтированный
        // компонент.
        map.removeEventListener('zoomstart', this.onZoomStart);
        map.removeEventListener('zoomend', this.onZoomEnd);
        stopMoveInterval(`vehicle-${id}-${num}`);
    }

    private onZoomStart = () => {
        this.commitTranslate();
    };

    private onZoomEnd = () => {
        setTimeout(() => this.updateTranslate(false), 0);
    };

    getIcon() {
        const { id, num, course, type, accessibility, warning, navTime } = this.props;
        this.stale = isStale(navTime);
        // Курс из данных приходит и вне диапазона 0..360 (встречается, например, 440), а без
        // нормализации проверка не срабатывает и бейджи остаются справа под остриём капли.
        const normalizedCourse = ((course % 360) + 360) % 360;
        const isCourseEast =
            normalizedCourse > EAST_COURSE_RANGE.left && normalizedCourse < EAST_COURSE_RANGE.right;

        return new L.DivIcon({
            iconSize: [33, 28],
            iconAnchor: [16.5, 14],
            popupAnchor: [0, -14],
            className: `${cn(styles.MapVehicle)}`,
            html: ReactDOMServer.renderToStaticMarkup(
                <MapVehicleMarker
                    id={id}
                    routeNumber={num}
                    type={type}
                    accessibility={accessibility}
                    warning={warning}
                    isCourseEast={isCourseEast}
                    course={course}
                    stale={this.stale}
                />,
            ),
        });
    }

    getScale = () => {
        const { map } = this.props;

        // Get the y,x dimensions of the map
        const { x, y } = map.getSize();

        // calculate the distance the one side of the map to the other using the haversine formula
        const maxMeters = map
            .containerPointToLatLng([0, y])
            .distanceTo(map.containerPointToLatLng([x, y]));

        // calculate how many meters each pixel represents
        return maxMeters / x;
    };

    onClickEventHandler = () => {
        const { routeDirection, routeId, num, setCurrentVehicle, type } = this.props;

        sidebarService.open({
            component: <MapVehiclesSidebar {...(this.props as MapVehiclesSidebarProps)} />,
            onClose: () => setCurrentVehicle(null),
        });

        setCurrentVehicle({
            num,
            routeId,
            routeDirection,
            type,
        });
    };

    private getMarkerElement = () => {
        const { id, num } = this.props;
        return document.querySelector(`#vehicle-${id}-${num}`) as HTMLDivElement;
    };

    private commitTranslate = () => {
        const markerElement = this.getMarkerElement();
        const marker = this.markerRef.current;
        if (!markerElement || !marker) return;

        commitMoveOffset({ map: this.props.map, marker, vehicle: markerElement });
    };

    private updateTranslate = (reset: boolean) => {
        const { id, num, speed, course } = this.props;

        const marker = this.getMarkerElement();

        if (!marker) {
            return;
        }

        stopMoveInterval(`vehicle-${id}-${num}`);
        if (reset) marker.style.transform = 'translate3d(0px, 0px, 0px)';

        // Машину с устаревшими координатами не двигаем: куда она едет сейчас, неизвестно.
        if (isStale(this.props.navTime)) return;

        startMoveInDirection({
            direction: course,
            vehicle: marker,
            velocity: speed,
            scale: this.getScale(),
        });
    };

    render() {
        const { coords } = this.props;

        return (
            <Marker
                icon={this.icon}
                position={coords}
                eventHandlers={{ click: this.onClickEventHandler }}
                ref={this.markerRef}
            />
        );
    }
}

const mapStateToProps = (state: State) => {
    const { currentVehicle } = state.publicTransport;

    return {
        currentVehicle,
    };
};
const mapDispatchToProps = {
    setCurrentVehicle,
};

// TODO: rewrite to functional component
export const MapVehiclesItem = withMap(
    // @ts-ignore somehow "typeof setCurrentVehicle" type is invalid for setCurrentVehicle prop
    connect(mapStateToProps, mapDispatchToProps)(MapVehiclesItemComponent),
);
