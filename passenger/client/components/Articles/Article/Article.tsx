import React from 'react';
import classNames from 'classnames/bind';
import parseMarkdown from './parseMarkdown';
import { CARD_ICONS } from 'components/MainPage/Card/cardIcons';

import { ArticleProps } from './Article.types';
import Link from 'next/link';

import styles from './Article.module.css';

const cn = classNames.bind(styles);

export function Article({ title, description, sidebar, external, slug }: ArticleProps) {
    // Открытая статья продолжает свою карточку с главной - поэтому у заголовка та же иконка.
    const Icon = slug ? CARD_ICONS[`/${slug}`] : undefined;

    return (
        <div className={cn(styles.Article, { [styles.Article_external]: external })}>
            {!external && <div className={cn(styles.ArticleControls)}>
                <Link className={cn(styles.ArticleBack)} href="/">
                    <span className={cn(styles.ArticleBackArrow)}>←</span>
                    <span className={cn(styles.ArticleBackCaption)}>На главную транспорта</span>
                </Link>
            </div>}
            
            <article className={cn(styles.ArticleContent)}>
                <div className={cn(styles.ArticleText)}>
                    {title && (
                        <h1 className={cn(styles.ArticleTitle)}>
                            {Icon && (
                                <Icon
                                    className={cn(styles.ArticleTitleIcon)}
                                    // Штрих Onest 500 - ~0.092em; иконка 0.8em в сетке 24,
                                    // значит обводка 0.092 x 24 / 0.8 = 2.75 даёт тот же вес.
                                    stroke={2.75}
                                    aria-hidden="true"
                                />
                            )}
                            {title}
                        </h1>
                    )}
                    {description && <div dangerouslySetInnerHTML={{ __html: parseMarkdown(description) }} />}
                </div>
                {sidebar !== undefined && <aside className={cn(styles.ArticleAside)}>
                    {sidebar && <div dangerouslySetInnerHTML={{ __html: parseMarkdown(sidebar) }} />}
                </aside>}
            </article>
        </div>
    )
}
