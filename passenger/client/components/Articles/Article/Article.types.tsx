export type ArticleProps = {
    title?: string;
    description: string;
    sidebar?: string;
    external?: boolean;
    /** Адрес статьи без слеша - по нему подбирается та же иконка, что у её карточки. */
    slug?: string;
};
