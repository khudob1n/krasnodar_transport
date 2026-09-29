import React, { useEffect, useState } from 'react';
import classNames from 'classnames/bind';
import { IconDroplet, IconGauge, IconSunrise, IconUmbrella, IconWind } from '@tabler/icons-react';

import { fetchWeatherDetails, WeatherDetails, WEATHER_TITLES, windName } from 'services/weather';
import { Typography } from 'components/UI/Typography/Typography';
import { Divider } from 'components/UI/Divider/Divider';

import { formatTemperature, WeatherIcon } from './WeatherBadge';
import styles from './MapWeatherSidebar.module.css';

const cn = classNames.bind(styles);

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['янв', 'февр', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сент', 'окт', 'нояб', 'дек'];

function dayLabel(date: string, index: number) {
    if (index === 0) return 'Сегодня';
    if (index === 1) return 'Завтра';
    const d = new Date(`${date}T12:00:00`);
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function Skeleton() {
    const bone = (width: string | number, height: number) => (
        <div className={cn(styles.WeatherBone)} style={{ width, height }} />
    );
    return (
        <div aria-label="Загружаем погоду" style={{ padding: '4px 22px 16px', display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {bone(56, 56)}
                <div style={{ display: 'grid', gap: 8, flex: 1 }}>
                    {bone('50%', 20)}
                    {bone('35%', 14)}
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {bone('100%', 56)}
                {bone('100%', 56)}
                {bone('100%', 56)}
                {bone('100%', 56)}
            </div>
            {bone('100%', 92)}
        </div>
    );
}

/**
 * Подробная погода по нажатию на плашку: сейчас, подсказка для поездки, ветер, влажность,
 * давление, восход и закат, по часам на сутки и на неделю. Open-Meteo, как и плашка.
 */
export function MapWeatherSidebar() {
    const [weather, setWeather] = useState<WeatherDetails | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let active = true;
        fetchWeatherDetails()
            .then((value) => active && setWeather(value))
            .catch(() => active && setFailed(true));
        return () => {
            active = false;
        };
    }, []);

    return (
        <div className={cn(styles.WeatherCard)}>
            <div className={cn(styles.WeatherHeader)}>
                <Typography variant="h4">Погода</Typography>
                <p className={cn(styles.WeatherNote)}>Краснодар</p>
            </div>
            {!weather && !failed && <Skeleton />}
            {failed && <p className={cn(styles.WeatherNote, styles.WeatherHeader)}>Не удалось загрузить погоду. Попробуйте позже.</p>}
            {weather && (
                <div data-card-stagger>
                    <div className={cn(styles.WeatherNow)}>
                        <WeatherIcon weather={weather} size={56} />
                        <span className={cn(styles.WeatherNowTemp)}>{formatTemperature(weather.temperature)}</span>
                        <span className={cn(styles.WeatherNowText)}>
                            <span>{WEATHER_TITLES[weather.kind]}</span>
                            <span>Ощущается как {formatTemperature(weather.feelsLike)}</span>
                        </span>
                    </div>

                    {weather.hint && (
                        <p className={cn(styles.WeatherHint)} role="status">
                            <IconUmbrella size={22} stroke={2} aria-hidden="true" />
                            {weather.hint}
                        </p>
                    )}

                    <div className={cn(styles.WeatherFacts)}>
                        <div className={cn(styles.WeatherFact)}>
                            <IconWind size={20} stroke={2} aria-hidden="true" />
                            <span className={cn(styles.WeatherFactBody)}>
                                {weather.wind} м/с
                                <span>
                                    {windName(weather.windFrom)}, порывы {weather.gusts}
                                </span>
                            </span>
                        </div>
                        <div className={cn(styles.WeatherFact)}>
                            <IconDroplet size={20} stroke={2} aria-hidden="true" />
                            <span className={cn(styles.WeatherFactBody)}>
                                {weather.humidity}%<span>влажность</span>
                            </span>
                        </div>
                        <div className={cn(styles.WeatherFact)}>
                            <IconGauge size={20} stroke={2} aria-hidden="true" />
                            <span className={cn(styles.WeatherFactBody)}>
                                {weather.pressure} мм<span>давление</span>
                            </span>
                        </div>
                        <div className={cn(styles.WeatherFact)}>
                            <IconSunrise size={20} stroke={2} aria-hidden="true" />
                            <span className={cn(styles.WeatherFactBody)}>
                                {weather.sunrise} – {weather.sunset}
                                <span>восход и закат</span>
                            </span>
                        </div>
                    </div>

                    <p className={cn(styles.WeatherSectionTitle)}>По часам</p>
                    <ul className={cn(styles.WeatherHours)}>
                        {weather.hours.map((hour, index) => (
                            <li key={hour.time + index} className={cn(styles.WeatherHour)}>
                                <span className={cn(styles.WeatherHourTime)}>{index === 0 ? 'Сейчас' : hour.time}</span>
                                <WeatherIcon weather={hour} size={22} />
                                {formatTemperature(hour.temperature)}
                                <span className={cn(styles.WeatherChance)}>
                                    {hour.precipitation >= 20 ? `${hour.precipitation}%` : ''}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <Divider />
                    <p className={cn(styles.WeatherSectionTitle)} style={{ paddingTop: 14 }}>
                        На неделю
                    </p>
                    <ul className={cn(styles.WeatherDays)}>
                        {weather.days.map((day, index) => (
                            <li key={day.date} className={cn(styles.WeatherDay)}>
                                <span>{dayLabel(day.date, index)}</span>
                                <WeatherIcon weather={{ kind: day.kind, isDay: true }} size={22} />
                                <span className={cn(styles.WeatherChance)}>
                                    {day.precipitation >= 20 ? `${day.precipitation}%` : ''}
                                </span>
                                <span className={cn(styles.WeatherDayRange)}>
                                    <span>{formatTemperature(day.min)}</span> … {formatTemperature(day.max)}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className={cn(styles.WeatherSource)}>Данные: Open-Meteo</p>
                </div>
            )}
        </div>
    );
}
