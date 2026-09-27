import React from 'react';

import { store } from 'state';
import { clearCurrent } from 'state/features/public-transport';
import { sidebarService } from 'services/sidebar/sidebar';

import { MapJourneySidebar } from './MapJourneySidebar';

/** Открыть панель «Маршрут» - из кнопки на карте, карточки остановки или ссылки. */
export function openJourneyPanel() {
    // Панель заменяет карточку остановки, не вызывая её onClose (см. sidebarService.open) -
    // сбрасываем выбранную остановку сами, иначе на карте остались бы её бледные маршруты.
    store.dispatch(clearCurrent());
    sidebarService.open({ component: <MapJourneySidebar /> });
}
