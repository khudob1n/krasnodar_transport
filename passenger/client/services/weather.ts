/**
 * Погода в Краснодаре для плашки на карте - Open-Meteo (открытый, без ключа, отвечает
 * с любого сайта). Обновляем раз в 15 минут: чаще их данные всё равно не меняются.
 */

const URL =
    'https://api.open-meteo.com/v1/forecast?latitude=45.0355&longitude=38.9753' +
    '&current=temperature_2m,weather_code,is_day&timezone=Europe%2FMoscow';

export const WEATHER_REFRESH_MS = 15 * 60 * 1000;

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface Weather {
    temperature: number;
    kind: WeatherKind;
    isDay: boolean;
}

// Коды погоды WMO (их отдаёт Open-Meteo) -> наши виды для иконки и подписи.
function kindOf(code: number): WeatherKind {
    if (code === 0) return 'clear';
    if (code <= 2) return 'partly';
    if (code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'rain';
}

export const WEATHER_TITLES: Record<WeatherKind, string> = {
    clear: 'Ясно',
    partly: 'Переменная облачность',
    cloudy: 'Пасмурно',
    fog: 'Туман',
    rain: 'Дождь',
    snow: 'Снег',
    storm: 'Гроза',
};

export async function fetchWeather(): Promise<Weather> {
    const response = await fetch(URL);
    if (!response.ok) throw new Error(`Open-Meteo: ${response.status}`);
    const { current } = await response.json();
    return {
        temperature: Math.round(current.temperature_2m),
        kind: kindOf(current.weather_code),
        isDay: current.is_day === 1,
    };
}
