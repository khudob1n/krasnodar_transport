import React from 'react';
import classNames from 'classnames/bind';

import styles from './MapStopsSidebarStopsListSkeleton.module.css';

const cn = classNames.bind(styles);

// Три строки - примерно столько прибытий обычно помещается в карточку, так что при подмене на
// реальные данные высота сайдбара почти не скачет.
const ROWS_COUNT = 3;

// Строка-заглушка повторяет геометрию MapStopsSidebarStopsListItem: бейдж маршрута слева,
// направление в две строки, время прибытия справа. Ширины текстовых полос чуть разные, иначе
// список читается как таблица, а не как загружающийся текст.
const ENDPOINT_WIDTHS = ['62%', '48%', '71%'];

export function MapStopsSidebarStopsListSkeleton() {
    return (
        <div className={cn(styles.MapStopsSidebarStopsListSkeleton)} aria-hidden>
            {Array.from({ length: ROWS_COUNT }, (_, index) => (
                <div className={cn(styles.MapStopsSidebarStopsListSkeletonRow)} key={index}>
                    <div className={cn(styles.MapStopsSidebarStopsListSkeletonInfo)}>
                        <div
                            className={cn(
                                styles.MapStopsSidebarStopsListSkeletonBone,
                                styles.MapStopsSidebarStopsListSkeletonRoute,
                            )}
                        />
                        <div className={cn(styles.MapStopsSidebarStopsListSkeletonText)}>
                            <div
                                className={cn(
                                    styles.MapStopsSidebarStopsListSkeletonBone,
                                    styles.MapStopsSidebarStopsListSkeletonEndpoint,
                                )}
                                style={{ width: ENDPOINT_WIDTHS[index] }}
                            />
                            <div
                                className={cn(
                                    styles.MapStopsSidebarStopsListSkeletonBone,
                                    styles.MapStopsSidebarStopsListSkeletonKeypoints,
                                )}
                            />
                        </div>
                    </div>
                    <div
                        className={cn(
                            styles.MapStopsSidebarStopsListSkeletonBone,
                            styles.MapStopsSidebarStopsListSkeletonTime,
                        )}
                    />
                </div>
            ))}
        </div>
    );
}
