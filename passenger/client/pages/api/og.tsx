import React from 'react';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

import { describeShare, PreviewUnit } from 'utils/sharePreview';

// Картинка превью ссылки на карту (TASK-223), 1200×630 - формат Telegram, VK и прочих.
// Edge: ImageResponse в pages router работает только там. Объект ищется заново по id из
// параметров (см. utils/sharePreview.ts), текст из ссылки не рисуется.
export const config = { runtime: 'edge' };

const COLORS: Record<PreviewUnit, string> = {
    bus: '#00B400',
    troll: '#00B4FF',
    tram: '#FF640F',
};
const BRAND = '#00B400';

const toBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    new Uint8Array(buffer).forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
};

// Адреса файлов - буквальными строками: так их видит сборщик и кладёт рядом с функцией.
const load = (url: URL) => fetch(url).then((response) => response.arrayBuffer());

export default async function handler(request: NextRequest) {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const [preview, regularCyr, boldCyr, regularLat, boldLat, logo] = await Promise.all([
        describeShare(query),
        load(new URL('../../assets/og/onest-cyrillic-400-normal.woff', import.meta.url)),
        load(new URL('../../assets/og/onest-cyrillic-700-normal.woff', import.meta.url)),
        load(new URL('../../assets/og/onest-latin-400-normal.woff', import.meta.url)),
        load(new URL('../../assets/og/onest-latin-700-normal.woff', import.meta.url)),
        // PNG, а не icon.svg: обрезку по контуру из SVG движок картинок не переносит и падает.
        load(new URL('../../public/favicon-192.png', import.meta.url)),
    ]);

    const accent = preview?.chip ? COLORS[preview.chip.unit] : BRAND;
    const heading = preview?.heading ?? 'Карта транспорта Краснодара';
    // Длинное название - мельче, чтобы влезло в две строки.
    const headingSize = heading.length > 44 ? 58 : heading.length > 26 ? 70 : 84;

    const image = new ImageResponse(
        (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    width: '100%',
                    height: '100%',
                    padding: '64px 72px',
                    background: '#ffffff',
                    fontFamily: 'OnestCyr, OnestLat',
                    color: '#16181c',
                    borderBottom: `16px solid ${accent}`,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={`data:image/png;base64,${toBase64(logo)}`}
                        width={64}
                        height={64}
                        alt=""
                    />
                    <span style={{ fontSize: 32, fontWeight: 700 }}>Транспорт Краснодара</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        {preview?.chip && (
                            <span
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 110,
                                    height: 72,
                                    padding: '0 22px',
                                    borderRadius: 22,
                                    background: accent,
                                    color: '#ffffff',
                                    fontSize: 52,
                                    fontWeight: 700,
                                }}
                            >
                                {preview.chip.num}
                            </span>
                        )}
                        <span style={{ fontSize: 34, color: '#55647D' }}>
                            {preview?.label ?? 'В реальном времени'}
                        </span>
                    </div>
                    <span
                        style={{
                            fontSize: headingSize,
                            fontWeight: 700,
                            lineHeight: 1.1,
                            letterSpacing: -1,
                        }}
                    >
                        {heading}
                    </span>
                    {(preview?.subheading ?? !preview) && (
                        <span style={{ fontSize: 34, color: '#55647D' }}>
                            {preview?.subheading ?? 'Автобусы, трамваи и троллейбусы'}
                        </span>
                    )}
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
            fonts: [
                // Кириллица и латиница (в ней цифры) - разными семействами: иначе движок берёт
                // для символа первый файл, где он есть, не глядя на жирность, и цифры в
                // заголовке выходили тонкими.
                { name: 'OnestCyr', data: regularCyr, weight: 400, style: 'normal' },
                { name: 'OnestCyr', data: boldCyr, weight: 700, style: 'normal' },
                { name: 'OnestLat', data: regularLat, weight: 400, style: 'normal' },
                { name: 'OnestLat', data: boldLat, weight: 700, style: 'normal' },
            ],
        },
    );

    // Отдаём картинку целиком, с длиной: ImageResponse - поток без Content-Length, а часть
    // роботов превью (мессенджеры) такие ответы отбрасывает. Заодно свои заголовки кэша -
    // у ImageResponse там «immutable на год», а объект в превью может поменяться.
    const body = await image.arrayBuffer();
    return new Response(body, {
        headers: {
            'Content-Type': 'image/png',
            'Content-Length': String(body.byteLength),
            'Cache-Control': 'public, max-age=600',
        },
    });
}
