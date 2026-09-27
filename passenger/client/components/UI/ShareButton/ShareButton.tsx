import React, { useEffect, useRef, useState } from 'react';
import { IconCheck, IconShare2 } from '@tabler/icons-react';

import { useSmoothCorners } from 'hooks/useSmoothCorners';

import pill from 'components/UI/PillButton/PillButton.module.css';
import { SHARE_URL } from 'transport-common/strapi/constants';

/**
 * «Поделиться» (TASK-217): на телефоне открывает системное меню «Поделиться», на компьютере
 * копирует ссылку в буфер и на пару секунд сообщает об этом. Ссылка открывает карту сразу на
 * объекте - см. components/Map/DeepLink/MapDeepLink.tsx.
 */
export function ShareButton({ url, title }: { url: string; title: string }) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [copied, setCopied] = useState(false);
    useSmoothCorners(buttonRef);

    useEffect(() => {
        if (!copied) return undefined;
        const timeout = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timeout);
    }, [copied]);

    const share = async () => {
        const isTouch = window.matchMedia('(pointer: coarse)').matches;

        if (isTouch && navigator.share) {
            try {
                await navigator.share({ title, url });
                return;
            } catch (e) {
                // Отмена в системном меню - не ошибка; просто ничего не делаем.
                if ((e as Error)?.name === 'AbortError') return;
            }
        }

        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch (e) {
            window.prompt('Скопируйте ссылку', url);
        }
    };

    const Icon = copied ? IconCheck : IconShare2;

    return (
        <button
            ref={buttonRef}
            type="button"
            className={pill.PillButton}
            onClick={(event) => {
                event.stopPropagation();
                share();
            }}
            title="Поделиться ссылкой"
        >
            <Icon className={pill.PillButtonIcon} aria-hidden="true" />
            <span aria-live="polite">{copied ? 'Ссылка скопирована' : 'Поделиться'}</span>
        </button>
    );
}

/** Начало ссылки «Поделиться»: посредник для превью в Telegram (SHARE_URL), в разработке - сам сайт. */
export const shareOrigin = () => SHARE_URL ?? window.location.origin;

/** Ссылка на карту, открытую на остановке или машине. */
export function mapShareUrl(params: { stop: string } | { vehicle: string }): string {
    const url = new URL('/map', shareOrigin());
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
}
