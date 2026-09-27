import { useEffect, useRef } from 'react';
import L from 'leaflet';

/**
 * Клики и прокрутка внутри элемента не доходят до карты под ним. Проверяем элемент после
 * каждого рендера, а не по [ref.current]: ref заполняется после рендера, и у элемента,
 * который появляется позже (панель избранного на телефоне открывается из кнопки), защита не
 * ставилась - нажатие в панели доходило до карты, и та закрывала только что открытую карточку.
 */
export const useDisablePropagation = (ref: React.MutableRefObject<HTMLElement>) => {
    const handled = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element || element === handled.current) return;
        L.DomEvent.disableClickPropagation(element);
        L.DomEvent.disableScrollPropagation(element);
        handled.current = element;
    });
};
