import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { waapi } from 'animejs';

import { useDisablePropagation } from 'hooks/useDisablePropagation';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { fetchWeather, Weather, WEATHER_REFRESH_MS } from 'services/weather';
import { prefersReducedMotion } from 'utils/reducedMotion';

import { WeatherBadge } from './WeatherBadge';

/** Плашка «погода сейчас» в ряду кнопок карты: иконка состояния и температура. */
export function MapWeather() {
    const ref = useRef<HTMLDivElement>(null);
    const [weather, setWeather] = useState<Weather | null>(null);

    useDisablePropagation(ref);
    useSmoothCorners(ref);

    useEffect(() => {
        let active = true;
        const load = () =>
            fetchWeather()
                .then((value) => active && setWeather(value))
                .catch((error) => console.warn('Погода недоступна', error));
        load();
        const timer = setInterval(load, WEATHER_REFRESH_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, []);

    // Плашка проявляется, когда погода впервые загрузилась (anime.js, waapi).
    const loaded = weather !== null;
    useLayoutEffect(() => {
        if (!loaded || !ref.current || prefersReducedMotion()) return undefined;
        const animation = waapi.animate(ref.current, {
            opacity: [0, 1],
            duration: 300,
            ease: 'out(2)',
        });
        return () => {
            animation.revert();
        };
    }, [loaded]);

    // Пока не загрузилась (или сервис недоступен) - плашки нет, ряд кнопок не прыгает.
    if (!weather) return null;

    return <WeatherBadge ref={ref} weather={weather} />;
}
