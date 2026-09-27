/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames/bind';

import { Article as ArticleType } from 'api/articles/articles.types';
import { Article } from 'components/Articles/Article/Article';
import { Modal } from 'components/UI/Modal/Modal';
import { useIntroAnimation } from 'hooks/useIntroAnimation';

import { MainPageTypes } from './MainPage.types';
import { Card } from './Card/Card';
import { CardTrafficJams } from './Card/CardDynamic/CardTrafficJams';
import { CardTransportA11y } from './Card/CardDynamic/CardTransportA11y';
import { CardMap } from './Card/CardDynamic/CardMap';

import Logo from './Logo.svg';

import styles from './MainPage.module.css';
import { Marquee } from './Marquee/Marquee';
import { ThemeToggle } from 'components/UI/ThemeToggle/ThemeToggle';

const cn = classNames.bind(styles);

export function MainPage({ cards, cardsDynamicData, marqueeItems, articles }: MainPageTypes) {
    const marqueeItemsData = marqueeItems.map(({ id, attributes: { message } }) => ({
        id,
        message,
    }));
    const [openedArticle, setOpenedArticle] = useState<ArticleType['attributes'] | null>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    useIntroAnimation(headerRef, gridRef);

    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            // history.state бывает null для записей, созданных не через pushState отсюда
            // (первый заход на страницу, переход с внешнего сайта, навигация Next.js) -
            // без этой проверки клик "Назад" на такой записи падает на e.state.articleSlug.
            if (!e.state) {
                setOpenedArticle(null);

                return;
            }

            const slug = e.state.articleSlug;

            if (e.state.url === '/' || slug === null) {
                setOpenedArticle(null);

                return;
            }

            if (slug) {
                const article = articles.find((a) => a.slug === slug);

                if (!article) {
                    return;
                }

                setOpenedArticle(article);
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => window.removeEventListener('popstate', handlePopState);
    }, [articles, setOpenedArticle]);

    const handleCardClick = useCallback(
        (url: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
            const cardSlug = url.slice(1);
            const article = articles.find((a) => a.slug === cardSlug);

            if (!article) {
                return;
            }

            e.preventDefault();
            setOpenedArticle(article);
            window.history.pushState({ articleSlug: cardSlug }, '', `/${cardSlug}`);
        },
        [articles, setOpenedArticle],
    );

    const handleCloseModal = useCallback(() => {
        setOpenedArticle(null);
        window.history.pushState({ articleSlug: null }, '', `/`);
    }, [setOpenedArticle]);

    const getDynamicContent = (dynamicId) => {
        switch (dynamicId) {
            case 'a11y-transport':
                return <CardTransportA11y {...cardsDynamicData.a11yTransportCounters} />;
            case 'traffic-jams':
                return <CardTrafficJams score={cardsDynamicData.trafficJams} />;
            case 'map':
                return <CardMap />;
        }
    };

    return (
        <div className={cn(styles.MainPage)}>
            <div className={cn(styles.MainPageInner)}>
                <div className={cn(styles.MainPageLogo)} ref={headerRef}>
                    <Logo />
                    <h1 className={cn(styles.MainPageTitle)}>
                        Транспорт
                        <br />
                        Краснодара
                    </h1>
                    <div className={cn(styles.MainPageThemeToggle)}>
                        <ThemeToggle smooth />
                    </div>
                </div>

                <div className={styles.MainPageCardGrid} ref={gridRef}>
                    {[...cards]
                        .sort((a, b) => a.attributes.priority - b.attributes.priority)
                        .map(({ id, attributes }) => {
                            return (
                                <Card
                                    type={attributes.type}
                                    title={attributes.title}
                                    titleBackgroundColor={attributes.titleBackgroundColor}
                                    url={attributes.url}
                                    backgroundImage={
                                        attributes?.backgroundImage?.data?.attributes?.url
                                    }
                                    backgroundImageHover={
                                        attributes?.backgroundImageHover?.data?.attributes?.url
                                    }
                                    headerCaption={attributes.headerCaption}
                                    footerCaption={attributes.footerCaption}
                                    dynamicContent={getDynamicContent(attributes.dynamicId)}
                                    isMap={attributes.dynamicId === 'map'}
                                    size={attributes.size}
                                    key={id}
                                    onClick={
                                        attributes.url.startsWith('/')
                                            ? handleCardClick(attributes.url)
                                            : null
                                    }
                                />
                            );
                        })}
                </div>

                <Marquee items={marqueeItemsData} />
                {openedArticle && (
                    <Modal onClose={handleCloseModal}>
                        <Article
                            title={openedArticle.title}
                            description={openedArticle.description}
                            sidebar={openedArticle.sidebar}
                            slug={openedArticle.slug}
                            external
                        />
                    </Modal>
                )}
            </div>
        </div>
    );
}
