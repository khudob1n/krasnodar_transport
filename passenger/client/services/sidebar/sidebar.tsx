import React, { Dispatch, SetStateAction, ReactElement } from 'react';

import { waapi, WAAPIAnimation } from 'animejs';

import { Sidepage } from 'components/UI/Sidepage/Sidepage';
import { prefersReducedMotion } from 'utils/reducedMotion';

// Номер открытия - ключ содержимого. Сайдбар один, и без ключа React переиспользовал экземпляр
// прошлой карточки того же вида: открыли маршрут 23, из поиска - 333, а выбранное направление
// (useState внутри карточки) осталось от 23-го, и остановок не было. Шторка (Sidepage) при этом
// та же - её положение сохраняется.
let openCount = 0;

class SidebarService {
    static instance = null;

    setSidebar: Dispatch<SetStateAction<ReactElement>>;

    private component: ReactElement = null;
    private closeAnimation: WAAPIAnimation | null = null;
    private onClose: VoidFunction;

    constructor() {
        if (SidebarService.instance) {
            return SidebarService.instance;
        }

        SidebarService.instance = this;
    }

    private listeners = new Set<(activeOnClose?: VoidFunction) => void>();

    readonly open = ({
        component,
        onClose,
    }: {
        component: ReactElement;
        onClose?: VoidFunction;
    }) => {
        // Не вызываем предыдущий onClose здесь: переход "карточка машины/маршрута -> клик по
        // одной из её остановок" тоже идёт через open() поверх уже открытой карточки, и он
        // нарочно держит currentVehicle/currentRoute выбранными (dispatch(setCurrentStop({...,
        // shouldClear: false})) перед этим open()) - вызов onClose машины здесь сбросил бы её
        // выбор. Вместо этого просто уведомляем подписчиков (см. onReplaced), что "их" сайдбар
        // молча заменили чужим - у них своя логика, что с этим делать.
        this.onClose = onClose;
        openCount += 1;
        // Открыли новую, пока старая уезжала, - скрытие отменяем и возвращаем шторке вид.
        if (this.closeAnimation) {
            this.closeAnimation.revert();
            this.closeAnimation = null;
            document
                .getElementById('Sidepage-scroll-container')
                ?.style.removeProperty('pointer-events');
        }
        this.component = <Sidepage>{React.cloneElement(component, { key: openCount })}</Sidepage>;
        this.setSidebar?.(this.component);
        this.listeners.forEach((listener) => listener(onClose));
    };

    // Кнопки-переключатели вроде Info/MapFavorites держат свой "открыто ли" в локальном
    // useState и полагаются на собственный onClose, чтобы его сбросить. Но open() из другого
    // места (клик по остановке/машине на карте) заменяет содержимое сайдбара, не вызывая
    // ничей onClose (см. выше) - без этого подписчика isOpen у такой кнопки застревал бы в
    // true, хотя её сайдбар на самом деле подменили. Слушатель получает onClose только что
    // открытой панели и сверяет со своим - см. hooks/useSidebarPanel.ts. Отписка - в
    // возвращаемой функции.
    readonly onReplaced = (listener: (activeOnClose?: VoidFunction) => void): VoidFunction => {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    };

    // Закрытая карточка сначала уезжает вниз и гаснет (anime.js, waapi), и только потом
    // убирается. Для всего остального она закрыта сразу: component = null, повторный close
    // ничего не делает, open открывает новую и отменяет скрытие.
    readonly close = () => {
        if (this.component === null) return;

        this.onClose?.();
        this.component = null;

        const sidepage =
            typeof document === 'undefined'
                ? null
                : document.getElementById('Sidepage-scroll-container');
        if (!sidepage || prefersReducedMotion()) {
            this.setSidebar?.(null);
            return;
        }

        sidepage.style.pointerEvents = 'none';
        this.closeAnimation = waapi.animate(sidepage, {
            opacity: [1, 0],
            translateY: ['0px', '16px'],
            duration: 220,
            ease: 'in(2)',
            onComplete: () => {
                if (this.component !== null) return;
                this.closeAnimation = null;
                sidepage.style.removeProperty('pointer-events');
                this.setSidebar?.(null);
            },
        });
    };
}

export const sidebarService = new SidebarService();
