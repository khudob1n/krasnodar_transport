import React, { useRef } from 'react';

import { useSmoothCorners } from 'hooks/useSmoothCorners';
import { getJourneyState, journeyActions } from 'services/journey/journeyStore';

import { openJourneyPanel } from './openJourneyPanel';

import pill from 'components/UI/PillButton/PillButton.module.css';
import styles from './JourneyStopButtons.module.css';

function JourneyPill({
    marker,
    label,
    hint,
    onClick,
}: {
    marker: 'A' | 'B';
    label: string;
    hint: string;
    onClick: () => void;
}) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    useSmoothCorners(buttonRef);

    return (
        <button
            ref={buttonRef}
            type="button"
            className={pill.PillButton}
            onClick={onClick}
            title={hint}
        >
            {/* Та же метка, что у точки в панели «Маршрут» и на карте, - размером с иконку. */}
            <span
                aria-hidden="true"
                className={`${styles.JourneyStopMarker} ${styles[`JourneyStopMarker_${marker}`]}`}
            >
                {marker}
            </span>
            <span>{label}</span>
        </button>
    );
}

/**
 * «Маршрут отсюда» и «Маршрут сюда» в карточке остановки и станции метро: ставят её началом
 * или концом маршрута и открывают панель «Маршрут». Вторая точка, выбранная раньше, сохраняется.
 * Обычные кнопки-таблетки в общем ряду действий карточки - как «Расписание» и «Поделиться».
 */
export function JourneyStopButtons({ stopId }: { stopId: string }) {
    const choose = (field: 'from' | 'to') => {
        const { from, to } = getJourneyState();
        // Выбрали ту же остановку, что уже стоит на другом конце, - это «поменять местами».
        if (field === 'from') journeyActions.setBoth(stopId, to === stopId ? from : to);
        else journeyActions.setBoth(from === stopId ? to : from, stopId);
        openJourneyPanel();
    };

    // Подпись над парой объясняет, что делают «Отсюда» и «Сюда», - без неё было непонятно,
    // а длинное «Маршрут отсюда» на телефоне не помещалось в кнопку.
    return (
        <>
            <span className={styles.JourneyStopCaption}>Построить маршрут</span>
            <JourneyPill
                marker="A"
                label="Отсюда"
                hint="Построить маршрут, который начинается здесь"
                onClick={() => choose('from')}
            />
            <JourneyPill
                marker="B"
                label="Сюда"
                hint="Построить маршрут, который заканчивается здесь"
                onClick={() => choose('to')}
            />
        </>
    );
}
