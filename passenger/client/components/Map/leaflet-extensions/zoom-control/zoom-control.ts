import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import { IconMinus, IconPlus } from '@tabler/icons-react';
import classNames from 'classnames/bind';

import { observeSmoothCorners } from 'hooks/useSmoothCorners';
import { withHotkey } from 'services/hotkeys';

import styles from './zoom-control.module.css';

const cn = classNames.bind(styles);

export class ZoomControl extends L.Control.Zoom {
    private stopObservingSmoothCorners: () => void;

    onAdd() {
        const container = L.DomUtil.create('div', cn(styles.ZoomControl));

        this.stopObservingSmoothCorners = observeSmoothCorners(container);

        L.DomEvent.disableClickPropagation(container);
        // TS tells that those buttons do not exist in ZoomControl
        // @ts-ignore
        // eslint-disable-next-line no-underscore-dangle
        this._zoomInButton = this.createButton('in', container);
        // @ts-ignore
        // eslint-disable-next-line no-underscore-dangle
        this._zoomOutButton = this.createButton('out', container);

        return container;
    }

    onRemove() {
        this.stopObservingSmoothCorners?.();
    }

    private createButton(type: string, container: HTMLElement) {
        const button = L.DomUtil.create('button', cn(styles.ZoomControlButton), container);

        // Иконки из основного набора проекта (Tabler) - в том же размере и толщине, что у
        // остальных кнопок карты. Цвет берётся из currentColor, поэтому в тёмной теме их больше
        // не нужно перекрашивать фильтром. Контрол - не React-компонент, иконку отрисовываем в
        // разметку один раз.
        button.innerHTML = renderToStaticMarkup(
            React.createElement(type === 'in' ? IconPlus : IconMinus, {
                size: 26,
                stroke: 2,
                'aria-hidden': true,
            }),
        );
        button.type = 'button';
        button.setAttribute('aria-label', type === 'in' ? 'Приблизить' : 'Отдалить');
        button.title = withHotkey(
            type === 'in' ? 'Приблизить' : 'Отдалить',
            type === 'in' ? 'zoom-in' : 'zoom-out',
        );
        button.dataset.hotkey = type === 'in' ? 'zoom-in' : 'zoom-out';

        // TS tells that those methods do not exist in ZoomControl
        // @ts-ignore
        // eslint-disable-next-line no-underscore-dangle
        L.DomEvent.on(button, 'click', type === 'in' ? this._zoomIn : this._zoomOut, this);

        return button;
    }
}
