import { ClientUnit } from 'transport-common/types/masstrans';

// Модуль читается и при серверной отрисовке (TransportIcon в легенде статей рендерится на
// сервере), где document нет - там берём запасные значения ниже.
const getColorFromCss = (name: string) =>
    typeof document === 'undefined'
        ? ''
        : getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();

export const TRAM_COLOR = getColorFromCss('tram') || '#FF640F';
export const TRAM_TRANSLUCENT_COLOR = getColorFromCss('tram-translucent') || '#ED9F74';
export const TROLL_COLOR = getColorFromCss('troll') || '#00B4FF';
export const TROLL_TRANSLUCENT_COLOR = getColorFromCss('troll-translucent') || '#80D9FF';
export const BUS_COLOR = getColorFromCss('bus') || '#00B400';
export const BUS_TRANSLUCENT_COLOR = getColorFromCss('bus-translucent') || '#6DC76D';

export const VEHICLE_TYPE_COLORS = {
    [ClientUnit.Tram]: TRAM_COLOR,
    [ClientUnit.Troll]: TROLL_COLOR,
    [ClientUnit.Bus]: BUS_COLOR,
};

export const VEHICLE_TYPE_TRANSLUCENT_COLORS = {
    [ClientUnit.Tram]: TRAM_TRANSLUCENT_COLOR,
    [ClientUnit.Troll]: TROLL_TRANSLUCENT_COLOR,
    [ClientUnit.Bus]: BUS_TRANSLUCENT_COLOR,
};
