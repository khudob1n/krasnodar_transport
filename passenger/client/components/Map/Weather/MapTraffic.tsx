import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { waapi } from 'animejs';
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';

import { useDisablePropagation } from 'hooks/useDisablePropagation';
import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { fetchTraffic, Traffic, TRAFFIC_REFRESH_MS } from 'services/traffic';
import { prefersReducedMotion } from 'utils/reducedMotion';

import styles from './MapWeather.module.css';

// Цвета балла - как у Яндекса: зелёный до 3, жёлтый до 6, красный дальше.
const COLORS = { green: '#3DB33D', yellow: '#F2B200', red: '#E5352B' } as const;

const colorOf = (traffic: Traffic) =>
    COLORS[traffic.color ?? (traffic.level <= 3 ? 'green' : traffic.level <= 6 ? 'yellow' : 'red')];

const plural = (n: number) =>
    n % 10 === 1 && n % 100 !== 11
        ? 'балл'
        : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
          ? 'балла'
          : 'баллов';

/** Плашка «пробки сейчас» в ряду кнопок карты: балл в кружке цвета загруженности. */
export function MapTraffic() {
    const ref = useRef<HTMLDivElement>(null);
    const [traffic, setTraffic] = useState<Traffic | null>(null);

    useDisablePropagation(ref);
    useSmoothCorners(ref);

    useEffect(() => {
        let active = true;
        const load = () =>
            fetchTraffic()
                .then((value) => active && setTraffic(value))
                .catch((error) => console.warn('Пробки недоступны', error));
        load();
        const timer = setInterval(load, TRAFFIC_REFRESH_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, []);

    // Плашка проявляется, когда балл впервые загрузился (anime.js, waapi).
    const loaded = traffic !== null;
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

    // Нет данных (Яндекс недоступен) - плашки нет, ряд кнопок не прыгает.
    if (!traffic) return null;

    const title = `Пробки: ${traffic.level} ${plural(traffic.level)}${
        traffic.hint ? ` — ${traffic.hint.toLowerCase()}` : ''
    }. По данным Яндекса`;

    return (
        <div ref={ref} className={styles.MapWeather} title={title} role="status" aria-label={title}>
            <span className={styles.MapTrafficLevel} style={{ backgroundColor: colorOf(traffic) }}>
                {traffic.level}
            </span>
            {traffic.trend > 0 && <IconTrendingUp size={18} stroke={2} aria-label="растут" />}
            {traffic.trend < 0 && <IconTrendingDown size={18} stroke={2} aria-label="спадают" />}
            {traffic.trend === 0 && (
                <span className={styles.MapTrafficLabel}>{plural(traffic.level)}</span>
            )}
        </div>
    );
}
