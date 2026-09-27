import React from 'react';
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
    return (
        <Html lang="ru">
            <Head>
                {/* Цвет полосы браузера и окна установленного приложения (TASK-216) - под тему. */}
                <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
                <meta name="theme-color" content="#16181c" media="(prefers-color-scheme: dark)" />
                <meta name="application-name" content="Транспорт КРД" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-title" content="Транспорт КРД" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                {/* Описание и превью ссылок (og/twitter) - в components/SeoMeta.tsx: там страница
                    может их заменить своими (next/head), а отсюда - нет. */}

                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="icon" href="/icon.svg" type="image/svg+xml" />
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <link rel="manifest" href="/site.webmanifest" />
            </Head>

            <body>
                {/* Ставим data-theme до гидрации, иначе при сохранённой тёмной теме будет
                    вспышка светлой на загрузке. Там же - сохранённые размеры значков карты
                    (components/IconSizesProvider.tsx), чтобы они не прыгали на загрузке. */}
                {/* eslint-disable-next-line react/no-danger */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}try{var s=JSON.parse(localStorage.getItem('icon-sizes')||'{}');for(var k in s){if(typeof s[k]==='number'){document.documentElement.style.setProperty('--icon-scale-'+k,String(Math.min(1.6,Math.max(0.6,s[k]))));}}}catch(e){}try{var p=JSON.parse(localStorage.getItem('map-preferences')||'{}');if(p.reduceMotion===true){document.documentElement.setAttribute('data-reduce-motion','');}if(p.labels===false){document.documentElement.setAttribute('data-map-no-labels','');}}catch(e){}})();`,
                    }}
                />
                <Main />
                <NextScript />

                {/* eslint-disable-next-line react/no-danger */}
                {process.env.YANDEX_METRIKA && (
                    <div
                        dangerouslySetInnerHTML={{
                            __html: `<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)}) (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");ym(${process.env.YANDEX_METRIKA}, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true });</script><noscript><div><img src="https://mc.yandex.ru/watch/${process.env.YANDEX_METRIKA}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>`,
                        }}
                    />
                )}
            </body>
        </Html>
    );
}
