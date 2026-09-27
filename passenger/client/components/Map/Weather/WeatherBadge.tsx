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

import { Weather, WEATHER_TITLES } from 'services/weather';

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

const iconColor = (weather: Weather) =>
    !weather.isDay && (weather.kind === 'clear' || weather.kind === 'partly')
        ? NIGHT_COLOR
        : ICON_COLORS[weather.kind];

function WeatherIcon({ weather }: { weather: Weather }) {
    const props = {
        size: 22,
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

/** Сама плашка: иконка состояния и температура. Без зависимостей от карты (Leaflet): рисуется и вне неё. */
export const WeatherBadge = React.forwardRef<HTMLDivElement, { weather: Weather }>(
    function WeatherBadge({ weather }, ref) {
        // Настоящий минус (U+2212), а не дефис: «−7°».
        const sign = weather.temperature > 0 ? '+' : weather.temperature < 0 ? '−' : '';
        const temperature = `${sign}${Math.abs(weather.temperature)}°`;
        const title = `${WEATHER_TITLES[weather.kind]}, ${temperature}`;

        return (
            <div
                ref={ref}
                className={styles.MapWeather}
                title={title}
                role="status"
                aria-label={title}
            >
                <WeatherIcon weather={weather} />
                <span>{temperature}</span>
            </div>
        );
    },
);
