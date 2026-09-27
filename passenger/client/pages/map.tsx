import React from 'react';
import Head from 'next/head';
import type { GetServerSideProps } from 'next';
import { SITE_URL } from 'transport-common/strapi/constants';

import { Map as MapComponent } from 'components/Map';
import { SeoMeta } from 'components/SeoMeta';
import { describeShare, SharePreview } from 'utils/sharePreview';

// Предупреждение "почему карта не работает" (маршрут.екатеринбург.рф заблокирован с 1
// декабря) убрано - у нас свой источник данных (server/+data/ в корне проекта через
// admin/api), карта реально работает.
export default function Map({ preview, url }: { preview: SharePreview | null; url: string }) {
    return (
        <>
            <Head>
                <title>{preview?.title ?? 'Карта транспорта Краснодара'}</title>
            </Head>
            {/* Ссылка на остановку, машину или маршрут - своё превью в мессенджерах (TASK-223). */}
            {preview && (
                <SeoMeta
                    title={preview.title}
                    description={preview.description}
                    image={preview.image}
                    url={url}
                />
            )}

            <MapComponent />
        </>
    );
}

// На сервере - только ради превью ссылок: мессенджеры читают мета-теги из HTML, скрипты не
// запускают. Обычная карта (без параметров) - сразу, без запросов к API.
export const getServerSideProps: GetServerSideProps = async ({ query, resolvedUrl }) => {
    const hasObject = ['stop', 'vehicle', 'from'].some((key) => key in query);
    const preview = hasObject ? await describeShare(query) : null;
    return { props: { preview, url: `${SITE_URL}${resolvedUrl}` } };
};
