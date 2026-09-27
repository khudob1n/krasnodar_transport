import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { animate, createTimeline } from 'animejs';
import { IconMap2, IconHome } from '@tabler/icons-react';
import { ClientUnit, StopType } from 'transport-common/types/masstrans';

import { MapVehiclesRoute } from 'components/Map/Vehicles/Route/MapVehiclesRoute';
import { MapVehicleMarker } from 'components/Map/Vehicles/Marker/MapVehicleMarker';
import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';
import { prefersReducedMotion } from 'utils/reducedMotion';

import stopStyles from 'components/Map/Stops/Item/MapStopsItem.module.css';
import styles from './NotFound.module.css';

/**
 * Страница 404: плашка маршрута «404» и сценка - автобус с табличкой («мы не нашли эту
 * страницу», «следую в депо»...) подъезжает к остановке, никого не находит, оглядывается и уезжает дальше. Анимация - anime.js (таймлайн по кругу); с
 * «уменьшить движение» автобус просто стоит у остановки.
 */
// Надписи на табличке автобуса - по мотивам настоящих («В парк», «Посадки нет»); на каждом
// круге сценки - следующая.
const BUS_SIGNS = [
    'мы не нашли эту страницу',
    'следую в депо',
    'посадки нет',
    'маршрут отменён',
    'страница ушла в парк',
    'остановка по требованию',
    'ищу пассажиров',
    'такой остановки нет',
];

export function NotFound() {
    const [sign, setSign] = useState(0);

    const sceneRef = useRef<HTMLDivElement>(null);
    const busRef = useRef<HTMLDivElement>(null);
    const questionRef = useRef<HTMLSpanElement>(null);
    const chipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scene = sceneRef.current;
        const bus = busRef.current;
        const question = questionRef.current;
        const chip = chipRef.current;
        if (!scene || !bus || !question || !chip || prefersReducedMotion()) return undefined;

        // Автобус стоит у остановки (вёрстка); сдвиги - от этого места. Табличка с номером -
        // слева от капли, поэтому за край уводим и её: заезд - из-за левого края целиком,
        // отъезд - пока не скроется и табличка.
        const base = bus.offsetLeft;
        const label = bus.querySelector<HTMLElement>('[class*="MapVehicleMarkerInfo"]');
        // Надписи разной длины - уводим с запасом под самую длинную.
        const labelWidth = Math.max(label?.offsetWidth ?? 0, 240) + 16;
        const start = -base - bus.offsetWidth - 16;
        const end = scene.clientWidth - base + labelWidth + 16;

        const bob = animate(chip, {
            y: [0, -6],
            duration: 1400,
            ease: 'inOut(2)',
            alternate: true,
            loop: true,
        });

        // Круг: заезд, остановка, «?» и оглядывается, отъезд за край, пауза за кадром.
        // Возврат на старт - в начале круга, пока автобуса не видно.
        const ride = createTimeline({
            loop: true,
            // Новый круг - новая надпись; меняется, пока автобус за кадром.
            onLoop: () => setSign((index) => (index + 1) % BUS_SIGNS.length),
        })
            .set(bus, { x: start, rotate: 0 })
            .set(question, { opacity: 0 })
            .add(bus, { x: [start, 0], duration: 2000, ease: 'out(3)' })
            .add(
                question,
                { opacity: [0, 1], scale: [0.4, 1], y: [8, 0], duration: 320, ease: 'outBack(2)' },
                '+=150',
            )
            .add(bus, { rotate: [0, -7, 6, -3, 0], duration: 900, ease: 'inOut(2)' }, '<<')
            .add(question, { opacity: [1, 0], y: [0, -6], duration: 260, ease: 'in(2)' }, '+=250')
            .add(bus, { x: [0, end], duration: 1900, ease: 'in(2)' }, '<<+=80')
            .add({ duration: 600 });

        return () => {
            bob.revert();
            ride.revert();
        };
    }, []);

    return (
        <main className={styles.NotFound}>
            <div className={styles.Scene} ref={sceneRef} aria-hidden="true">
                <div className={styles.Chip} ref={chipRef}>
                    <MapVehiclesRoute type={ClientUnit.Bus} num="404" size="l" />
                </div>
                <div className={styles.Road} />
                {/* Остановка и автобус - те же значки, что на карте (как в легенде). */}
                <span className={`${stopStyles.MapStopsItemPin} ${styles.Stop}`}>
                    <TransportIcon type={StopType.Bus} variant="stop" alt="" />
                </span>
                <div className={styles.Bus} ref={busRef}>
                    <span className={styles.Question} ref={questionRef}>
                        ?
                    </span>
                    <span className={styles.BusMarker}>
                        <MapVehicleMarker
                            id="not-found-bus"
                            routeNumber={BUS_SIGNS[sign]}
                            type={ClientUnit.Bus}
                            course={90}
                            isCourseEast
                        />
                    </span>
                </div>
            </div>

            <h1 className={styles.Title}>Такого маршрута нет</h1>
            <p className={styles.Text}>
                Страница не нашлась: ссылка устарела или маршрут отменили. Автобус проверил
                остановку — здесь никого, поехал дальше.
            </p>

            <div className={styles.Actions}>
                <Link href="/map" className={`${styles.Button} ${styles.Button_primary}`}>
                    <IconMap2 size={20} stroke={2} aria-hidden="true" />
                    Открыть карту
                </Link>
                <Link href="/" className={styles.Button}>
                    <IconHome size={20} stroke={2} aria-hidden="true" />
                    На главную
                </Link>
            </div>
        </main>
    );
}
