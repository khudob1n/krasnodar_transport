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

// ---------------- Подробная погода (карточка по нажатию на плашку) ----------------

const DETAILS_URL =
    'https://api.open-meteo.com/v1/forecast?latitude=45.0355&longitude=38.9753' +
    '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,' +
    'wind_direction_10m,wind_gusts_10m,relative_humidity_2m,surface_pressure' +
    '&minutely_15=precipitation&forecast_minutely_15=8' +
    '&hourly=temperature_2m,weather_code,is_day,precipitation_probability&forecast_hours=24' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
    '&forecast_days=7&wind_speed_unit=ms&timezone=Europe%2FMoscow';

export interface WeatherHour {
    /** «14:00» */
    time: string;
    temperature: number;
    kind: WeatherKind;
    isDay: boolean;
    /** Вероятность осадков, % */
    precipitation: number;
}

export interface WeatherDay {
    /** «2026-09-29» */
    date: string;
    min: number;
    max: number;
    kind: WeatherKind;
    precipitation: number;
}

export interface WeatherDetails extends Weather {
    feelsLike: number;
    /** Ветер, м/с, и откуда дует (градусы) */
    wind: number;
    gusts: number;
    windFrom: number;
    humidity: number;
    /** Давление, мм рт. ст. */
    pressure: number;
    sunrise: string;
    sunset: string;
    /** Подсказка для поездки: дождь скоро, сильный ветер, мороз, жара - или null. */
    hint: string | null;
    hours: WeatherHour[];
    days: WeatherDay[];
}

const COMPASS8 = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];

/** «СВ» - откуда дует ветер (как в прогнозах). */
export const windName = (degrees: number) => COMPASS8[Math.round(degrees / 45) % 8];

const hhmm = (iso: string) => iso.slice(11, 16);

/**
 * Подсказка для поездки - одна, самая важная: осадки сейчас или в ближайшие 2 часа, сильный
 * ветер, мороз или жара.
 */
function hintOf(
    kind: WeatherKind,
    temperature: number,
    feelsLike: number,
    gusts: number,
    minutely: { time: string[]; precipitation: number[] },
    currentTime: string,
): string | null {
    const wet = kind === 'rain' || kind === 'snow' || kind === 'storm';
    const what = temperature <= 0 ? 'снег' : 'дождь';
    if (wet) return kind === 'storm' ? 'Сейчас гроза — лучше переждать под крышей.' : `Сейчас ${what} — возьмите зонт.`;
    const now = new Date(currentTime).getTime();
    const index = minutely.precipitation.findIndex((mm) => mm >= 0.1);
    if (index >= 0) {
        const minutes = Math.max(15, Math.round((new Date(minutely.time[index]).getTime() - now) / 60000));
        return `Через ${minutes} мин ${what} — возьмите зонт.`;
    }
    if (gusts >= 15) return `Сильный ветер, порывы до ${Math.round(gusts)} м/с.`;
    if (feelsLike <= -10) return 'Мороз — одевайтесь теплее, ожидание на остановке будет холодным.';
    if (feelsLike >= 32) return 'Жарко — возьмите воду.';
    return null;
}

export async function fetchWeatherDetails(): Promise<WeatherDetails> {
    const response = await fetch(DETAILS_URL);
    if (!response.ok) throw new Error(`Open-Meteo: ${response.status}`);
    const { current, hourly, daily, minutely_15: minutely } = await response.json();
    const kind = kindOf(current.weather_code);
    const temperature = Math.round(current.temperature_2m);
    const feelsLike = Math.round(current.apparent_temperature);
    return {
        temperature,
        kind,
        isDay: current.is_day === 1,
        feelsLike,
        wind: Math.round(current.wind_speed_10m),
        gusts: Math.round(current.wind_gusts_10m),
        windFrom: current.wind_direction_10m,
        humidity: Math.round(current.relative_humidity_2m),
        pressure: Math.round(current.surface_pressure * 0.750062),
        sunrise: hhmm(daily.sunrise[0]),
        sunset: hhmm(daily.sunset[0]),
        hint: hintOf(kind, temperature, feelsLike, current.wind_gusts_10m, minutely, current.time),
        // Первый час - «сейчас»: состояние и температура как в «сейчас», а не среднее за час.
        hours: hourly.time.map((time: string, i: number) => ({
            time: hhmm(time),
            temperature: i === 0 ? temperature : Math.round(hourly.temperature_2m[i]),
            kind: i === 0 ? kind : kindOf(hourly.weather_code[i]),
            isDay: i === 0 ? current.is_day === 1 : hourly.is_day[i] === 1,
            precipitation: hourly.precipitation_probability[i] ?? 0,
        })),
        days: daily.time.map((date: string, i: number) => ({
            date,
            min: Math.round(daily.temperature_2m_min[i]),
            max: Math.round(daily.temperature_2m_max[i]),
            kind: kindOf(daily.weather_code[i]),
            precipitation: daily.precipitation_probability_max[i] ?? 0,
        })),
    };
}
