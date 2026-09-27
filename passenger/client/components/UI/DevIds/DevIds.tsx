import React, { useState } from 'react';

import { useDevSettings } from 'components/DevSettingsProvider';

import styles from './DevIds.module.css';

/**
 * Внутренние ID объекта в карточке - видны, только если в настройках включён тумблер
 * «Показывать ID в карточках». Клик по значению копирует его в буфер обмена.
 */
export function DevIds({ items }: { items: [label: string, value: string | number | undefined | null][] }) {
    const { showIds } = useDevSettings();
    const [copied, setCopied] = useState<string | null>(null);

    const visible = items.filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (!showIds || !visible.length) return null;

    return (
        <dl className={styles.DevIds} aria-label="ID для разработчиков">
            {visible.map(([label, value]) => (
                <div className={styles.DevIdsItem} key={label}>
                    <dt>{label}</dt>
                    <dd>
                        <button
                            type="button"
                            title="Скопировать"
                            onClick={(event) => {
                                // Карточки кликабельны целиком (строки списков) - не отдаём клик им.
                                event.stopPropagation();
                                navigator.clipboard?.writeText(String(value)).then(
                                    () => setCopied(label),
                                    () => undefined,
                                );
                            }}
                        >
                            {String(value)}
                            {copied === label && <span className={styles.DevIdsCopied}>скопировано</span>}
                        </button>
                    </dd>
                </div>
            ))}
        </dl>
    );
}
