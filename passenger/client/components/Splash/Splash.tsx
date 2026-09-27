import React, { useState } from 'react';
import classNames from 'classnames/bind';

import Logo from 'components/MainPage/Logo.svg';

import styles from './Splash.module.css';

const cn = classNames.bind(styles);

/**
 * Стартовая заставка: логотип и название на весь экран, затем плавный уход к приложению.
 *
 * Анимация на CSS, а не на anime.js: играет ровно в момент загрузки, когда главный поток
 * занят разбором бандла и инициализацией карты. Покадровая анимация там растягивается на
 * десятки секунд (см. TASK-172), а CSS считает браузер, и от джанка она не зависит. Заодно
 * заставка уходит, даже если гидрация запоздала - React только убирает её из DOM.
 *
 * Живёт в _app, поэтому показывается один раз за полную загрузку страницы, а не на каждом
 * клиентском переходе.
 */
export function Splash() {
    const [hidden, setHidden] = useState(false);

    if (hidden) {
        return null;
    }

    return (
        <div
            className={cn(styles.Splash)}
            aria-hidden="true"
            // Всплывает и animationend внутреннего блока, поэтому реагируем только на свой.
            onAnimationEnd={(event) => {
                if (event.target === event.currentTarget) {
                    setHidden(true);
                }
            }}
        >
            <div className={cn(styles.SplashContent)}>
                <Logo className={cn(styles.SplashLogo)} />
                <p className={cn(styles.SplashTitle)}>
                    Транспорт
                    <br />
                    Краснодара
                </p>
            </div>
        </div>
    );
}
