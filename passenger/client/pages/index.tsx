import React from 'react';
import Head from 'next/head';
import { MainPageApi } from 'api/main-page/main-page';
import { articlesApi } from 'api/articles/articles';
import { MainPage } from 'components/MainPage/MainPage';

export default function Home(props) {
    return (
        <>
            <Head>
                <title>Транспорт Краснодара</title>
            </Head>
            <MainPage {...props} />
        </>
    );
}

export async function getStaticProps() {
    return {
        props: {
            cards: (await MainPageApi.getCards()) || [],
            cardsDynamicData: {
                trafficJams: (await MainPageApi.getTrafficJamsCounter()) || null,
                a11yTransportCounters: (await MainPageApi.getA11yTransportCounters()) || {},
            },
            marqueeItems: (await MainPageApi.getMarqueeItems()) || [],
            // Статьи недоступны (API лежит) - главная собирается без них, а не падает вся сборка.
            articles: (await articlesApi.getAllArticles().catch(() => [])).map(
                (article) => article.attributes,
            ),
        },
        revalidate: 600,
    };
}
