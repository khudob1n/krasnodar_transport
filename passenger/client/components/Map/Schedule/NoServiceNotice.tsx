import React from 'react';

import NoServiceIcon from 'public/icons/no-service.svg';

import styles from './NoServiceNotice.module.css';

export function NoServiceNotice({
    title = 'Нет отправлений на сегодня',
    text = 'Транспорт сегодня не ходит или расписание не опубликовано',
}: {
    title?: string;
    text?: string;
}) {
    return (
        <div className={styles.NoServiceNotice} role="status">
            <span className={styles.NoServiceNoticeIcon} aria-hidden="true">
                <NoServiceIcon />
            </span>
            <div>
                <strong>{title}</strong>
                <span>{text}</span>
            </div>
        </div>
    );
}
