import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import { IconMapPin } from '@tabler/icons-react';
import classNames from 'classnames/bind';

import { observeSmoothCorners } from 'hooks/useSmoothCorners';
import { withHotkey } from 'services/hotkeys';

import { MovingMarker } from '../moving-marker';
import { MARGIN_OF_EQUALS_ERROR } from './user-placemark-control.constants';
import {
    UserPlacemarkControlState,
    UserPlacemarkControlOptions,
} from './user-placemark-control.types';

import styles from './user-placemark-control.module.css';

const cn = classNames.bind(styles);

export class UserPlacemarkControl extends L.Control {
    private state: UserPlacemarkControlState = UserPlacemarkControlState.Free;

    private userPlacemark: MovingMarker;

    private map: L.Map;

    private container: HTMLDivElement;

    private onClickHandler: () => void;

    private stopObservingSmoothCorners: () => void;

    constructor(userPlacemark: MovingMarker, options: UserPlacemarkControlOptions) {
        const { onClickHandler, ...superOptions } = options;
        super(superOptions);

        this.userPlacemark = userPlacemark;
        this.onClickHandler = onClickHandler;
    }

    onRemove(): void {
        this.userPlacemark?.removeEventListener('move', this.moveMapCenter);
        // Раньше 'drag' вешался анонимной функцией в onAdd и никогда не снимался здесь.
        // Контроль пересоздаётся при каждом ре-рендере MapUserPlacemarkControl (см. её эффект -
        // options там был литералом, из-за чего пересоздавался на каждый рендер), так что на
        // карту навешивался новый обработчик почти на каждое движение карты пользователем.
        this.map?.removeEventListener('drag', this.onDrag);
        this.stopObservingSmoothCorners?.();
    }

    private onDrag = () => {
        this.setFreeState(this.container);
        this.userPlacemark?.removeEventListener('move', this.moveMapCenter);
    };

    onAdd(map: L.Map) {
        this.map = map;
        const container = L.DomUtil.create('div', cn(styles.UserPlacemarkControl));
        this.container = container;

        this.stopObservingSmoothCorners = observeSmoothCorners(container);

        const button = L.DomUtil.create('button', cn(styles.UserPlacemarkControlButton), container);

        // Иконка из основного набора проекта (Tabler), в том же размере и толщине, что у
        // соседних кнопок карты (тема, настройки). Контрол - не React-компонент, поэтому
        // иконку отрисовываем в разметку один раз.
        button.innerHTML = renderToStaticMarkup(
            React.createElement(IconMapPin, { size: 26, stroke: 2, 'aria-hidden': true }),
        );
        button.setAttribute('aria-label', 'Показать моё местоположение');
        button.title = withHotkey('Моё местоположение', 'location');
        button.dataset.hotkey = 'location';

        L.DomEvent.on(button, 'click', () => this.onClick(container), this);
        L.DomEvent.disableClickPropagation(container);

        // Именованный обработчик - тот же, что снимает onRemove (анонимный не снимался).
        this.map.addEventListener('drag', this.onDrag);

        if (this.userPlacemark) {
            this.updateStateByUserPlacemark(container);
        }

        return container;
    }

    private updateStateByUserPlacemark(control: HTMLDivElement) {
        if (this.map.getCenter().equals(this.userPlacemark?.getLatLng(), MARGIN_OF_EQUALS_ERROR)) {
            this.setCenteredState(control);
        } else {
            this.setFreeState(control);
        }
    }

    private setCenteredState(control: HTMLDivElement) {
        if (this.state === UserPlacemarkControlState.Centered) {
            return;
        }

        this.state = UserPlacemarkControlState.Centered;
        control.classList.add(cn(styles.UserPlacemarkControlCentered));

        this.userPlacemark?.addEventListener('move', this.moveMapCenter);
    }

    private setFreeState(control: HTMLDivElement) {
        if (this.state === UserPlacemarkControlState.Free) {
            return;
        }

        this.state = UserPlacemarkControlState.Free;
        control.classList.remove(cn(styles.UserPlacemarkControlCentered));
    }

    private moveMapCenter = () => {
        // Маркер без координат ещё не на карте (ждём геолокацию) - центрировать не на что.
        if (!this.userPlacemark || !this.map.hasLayer(this.userPlacemark)) {
            return;
        }

        this.map.setView(this.userPlacemark.getLatLng());
    };

    private onClick(control: HTMLDivElement) {
        if (this.onClickHandler) {
            this.onClickHandler();
        }

        if (this.state === UserPlacemarkControlState.Free) {
            this.moveMapCenter();

            this.setCenteredState(control);
        }
    }
}
