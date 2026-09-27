import React from 'react';
import Head from 'next/head';

import { articlesApi } from 'api/articles/articles';
import { ArticleProps } from 'components/Articles/Article/Article.types';
import { Article } from 'components/Articles/Article/Article';

function ArticlePage({ title, description, sidebar, slug }: ArticleProps) {
    return (
        <>
            <Head>
                <title>{`Транспорт Краснодара — ${title}`}</title>
            </Head>

            <Article title={title} description={description} sidebar={sidebar} slug={slug} />
        </>
    );
}

export async function getServerSideProps({ params }) {
    const article = (await articlesApi.getArticle(params.slug)).at(0)?.attributes;

    // Статьи с таким адресом нет - это 404, а не пустая страница статьи с кодом 200.
    if (!article) {
        return { notFound: true };
    }

    return {
        props: { ...article, slug: params.slug },
    };
}

export default ArticlePage;
