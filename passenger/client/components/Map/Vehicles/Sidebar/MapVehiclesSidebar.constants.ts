import { ClientUnit } from 'transport-common/types/masstrans';

export const vehiclesName = {
    [ClientUnit.Bus]: 'автобус',
    [ClientUnit.Troll]: 'троллейбус',
    [ClientUnit.Tram]: 'трамвай',
};

export const additionalHeader = {
    [ClientUnit.Bus]: 'об автобусе',
    [ClientUnit.Troll]: 'о троллейбусе',
    [ClientUnit.Tram]: 'о трамвае',
};

// Регион номера по умолчанию, если в госномере его нет: Краснодарский край.
export const KRASNODAR_REGION = '23';

export const featuresTitle = {
    stroller: 'можно с коляской',
    accessibility: 'можно с инвалидным креслом',
    bike: 'можно с велосипедом',
    wifi: 'есть бесплатный вайфай',
    elderly: 'есть места для пенсионеров',
    warning: 'измененный маршрут',
};
