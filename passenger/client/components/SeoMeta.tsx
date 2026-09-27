import React from 'react';
import Head from 'next/head';
import { SITE_URL } from 'transport-common/strapi/constants';

const SITE_TITLE = 'Транспорт Краснодара';
const SITE_DESCRIPTION =
    'Всё про транспорт Краснодара. Цена проезда, карта транспорта, расписание маршрутов, статус пробок и правила парковок.';

/**
 * Мета-теги превью ссылки (Telegram, VK...). По умолчанию - общие для сайта; страница может
 * передать свои (карта - для ссылки на остановку, машину или маршрут, TASK-223). Теги с
 * key: next/head оставляет последний с тем же ключом, поэтому страничные заменяют общие.
 * Раньше общие жили в _document и страница переопределить их не могла - у мессенджеров
 * выигрывал первый og:image.
 */
export function SeoMeta({
    title = SITE_TITLE,
    description = SITE_DESCRIPTION,
    image = `${SITE_URL}/og-preview.jpg`,
    url = SITE_URL,
}: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
}) {
    return (
        <Head>
            <meta key="description" name="description" content={description} />
            <meta key="og:type" property="og:type" content="website" />
            <meta key="og:url" property="og:url" content={url} />
            <meta key="og:title" property="og:title" content={title} />
            <meta key="og:description" property="og:description" content={description} />
            <meta key="og:site_name" property="og:site_name" content={SITE_TITLE} />
            <meta key="og:locale" property="og:locale" content="ru_RU" />
            <meta key="og:image" property="og:image" content={image} />
            {/* Размеры и тип картинки: по ним мессенджеры сразу решают показать большое превью,
                не скачивая картинку. У общей og-preview.jpg их нет - она другого размера. */}
            {image.includes('/api/og') && (
                <>
                    <meta key="og:image:type" property="og:image:type" content="image/png" />
                    <meta key="og:image:width" property="og:image:width" content="1200" />
                    <meta key="og:image:height" property="og:image:height" content="630" />
                </>
            )}
            <meta key="twitter:card" property="twitter:card" content="summary_large_image" />
            <meta key="twitter:url" property="twitter:url" content={url} />
            <meta key="twitter:title" property="twitter:title" content={title} />
            <meta key="twitter:description" property="twitter:description" content={description} />
            <meta key="twitter:image" property="twitter:image" content={image} />
        </Head>
    );
}
