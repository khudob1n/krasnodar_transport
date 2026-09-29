import React from 'react';
import {
    IconCloud,
    IconCloudFog,
    IconCloudRain,
    IconCloudSnow,
    IconCloudStorm,
    IconMoon,
    IconMoonStars,
    IconSunLow,
    IconSunHigh,
} from '@tabler/icons-react';

import { Weather, WeatherKind, WEATHER_TITLES } from 'services/weather';

import styles from './MapWeather.module.css';

// Цвет иконки по состоянию: так дождь, снег и гроза различаются с первого взгляда, а не
// только по рисунку (серые на 22px они почти одинаковые).
const ICON_COLORS: Record<Weather['kind'], string> = {
    clear: '#F2B200',
    partly: '#F2B200',
    cloudy: 'var(--functional)',
    fog: 'var(--functional)',
    rain: '#3B82F6',
    snow: '#38BDF8',
    storm: '#8B5CF6',
};
// Ночью солнца нет - луна спокойного сине-серого.
const NIGHT_COLOR = '#8A9BD6';

const iconColor = (weather: { kind: WeatherKind; isDay: boolean }) =>
    !weather.isDay && (weather.kind === 'clear' || weather.kind === 'partly')
        ? NIGHT_COLOR
        : ICON_COLORS[weather.kind];

/** Иконка состояния погоды цветом состояния (ночью ясно - луна). */
export function WeatherIcon({ weather, size = 22 }: { weather: { kind: WeatherKind; isDay: boolean }; size?: number }) {
    const props = {
        size,
        stroke: 2,
        'aria-hidden': true,
        style: { color: iconColor(weather) },
    } as const;
    switch (weather.kind) {
        case 'clear':
            return weather.isDay ? <IconSunHigh {...props} /> : <IconMoonStars {...props} />;
        case 'partly':
            return weather.isDay ? <IconSunLow {...props} /> : <IconMoon {...props} />;
        case 'cloudy':
            return <IconCloud {...props} />;
        case 'fog':
            return <IconCloudFog {...props} />;
        case 'snow':
            return <IconCloudSnow {...props} />;
        case 'storm':
            return <IconCloudStorm {...props} />;
        default:
            return <IconCloudRain {...props} />;
    }
}

/** Температура с настоящим минусом (U+2212), а не дефисом: «−7°», «+15°». */
export const formatTemperature = (value: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}°`;

/**
 * Сама плашка: иконка состояния и температура. Без зависимостей от карты (Leaflet): рисуется и
 * вне неё. С onClick - кнопка, открывает подробную погоду.
 */
export const WeatherBadge = React.forwardRef<
    HTMLButtonElement,
    { weather: Weather; onClick?: () => void; opened?: boolean }
>(function WeatherBadge({ weather, onClick, opened }, ref) {
    const temperature = formatTemperature(weather.temperature);
    const title = `${WEATHER_TITLES[weather.kind]}, ${temperature}`;

    return (
        <button
            ref={ref}
            type="button"
            className={`${styles.MapWeather} ${onClick ? styles.MapWeather_button : ''} ${opened ? styles.MapWeather_opened : ''}`}
            title={onClick ? `${title}. Подробная погода` : title}
            aria-label={onClick ? `${title}. Подробная погода` : title}
            aria-expanded={onClick ? Boolean(opened) : undefined}
            onClick={onClick}
            disabled={!onClick}
        >
            <WeatherIcon weather={weather} />
            <span>{temperature}</span>
        </button>
    );
});
