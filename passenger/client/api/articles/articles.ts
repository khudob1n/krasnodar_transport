import { fetchAllRecords, fetchOneByFilter } from 'api/ekb/collections';
import { Article } from './articles.types';

// data/site/faq_articles.json - тот же формат карточки-статьи, что и Article.attributes,
// только плоский (без Strapi id/attributes) и с markdown в body вместо description.
interface FaqArticleRecord {
    slug: string;
    title: string;
    order: number;
    body: string;
}

function toArticle(row: FaqArticleRecord): Article {
    return {
        id: row.order,
        attributes: {
            title: row.title,
            description: row.body,
            slug: row.slug,
        } as any,
    };
}

export const articlesApi = {
    getArticles: async (): Promise<Article[]> => {
        const rows = await fetchAllRecords<FaqArticleRecord>('site/faq_articles');
        return rows.map(toArticle);
    },
    getArticle: async (slug: string): Promise<Article[]> => {
        const row = await fetchOneByFilter<FaqArticleRecord>('site/faq_articles', { slug });
        return row ? [toArticle(row)] : [];
    },
    getAllArticles: async (): Promise<Article[]> => {
        const rows = await fetchAllRecords<FaqArticleRecord>('site/faq_articles');
        return rows.sort((a, b) => a.order - b.order).map(toArticle);
    },
};
