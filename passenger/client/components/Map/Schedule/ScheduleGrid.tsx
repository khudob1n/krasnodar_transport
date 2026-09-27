import React, { useMemo } from 'react';

import ChevronDown from 'public/icons/chevron-down.svg';

import styles from './ScheduleGrid.module.css';

interface Props {
    times: string[];
    hidePast: boolean;
    onHidePastChange: (value: boolean) => void;
    canHidePast: boolean;
    emptyText?: string;
}

const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export function ScheduleGrid({
    times,
    hidePast,
    onHidePastChange,
    canHidePast,
    emptyText = 'Нет данных о расписании',
}: Props) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const rows = useMemo(() => {
        const grouped = new Map<string, string[]>();

        Array.from(new Set(times))
            .sort((left, right) => timeToMinutes(left) - timeToMinutes(right))
            .filter((time) => !hidePast || !canHidePast || timeToMinutes(time) >= currentMinutes)
            .forEach((time) => {
                const [hour, minute] = time.split(':');
                grouped.set(hour, [...(grouped.get(hour) ?? []), minute]);
            });

        return Array.from(grouped.entries());
    }, [canHidePast, currentMinutes, hidePast, times]);

    return (
        <div className={styles.ScheduleGrid}>
            <button
                type="button"
                className={styles.ScheduleGridFilter}
                disabled={!canHidePast}
                aria-expanded={!hidePast}
                onClick={() => onHidePastChange(!hidePast)}
            >
                <span>{hidePast ? 'Показать прошедшие' : 'Скрыть прошедшие'}</span>
                <ChevronDown
                    className={`${styles.ScheduleGridFilterArrow} ${
                        hidePast ? styles.ScheduleGridFilterArrowCollapsed : ''
                    }`}
                />
            </button>

            {rows.length ? (
                <div className={styles.ScheduleGridRows}>
                    {rows.map(([hour, minutes]) => (
                        <div className={styles.ScheduleGridRow} key={hour}>
                            <strong>{hour}</strong>
                            <div>
                                {minutes.map((minute) => (
                                    <span key={minute}>{minute}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className={styles.ScheduleGridEmpty}>{emptyText}</p>
            )}
        </div>
    );
}
