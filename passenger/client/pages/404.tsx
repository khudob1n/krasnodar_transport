import React from 'react';
import Head from 'next/head';

import { NotFound } from 'components/NotFound/NotFound';

export default function NotFoundPage() {
    return (
        <>
            <Head>
                <title>Страница не найдена — Транспорт Краснодара</title>
            </Head>
            <NotFound />
        </>
    );
}
