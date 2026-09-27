import { isMetroStop, isPlaceId } from './planner';
import { PlannedJourney } from './schedule';

/** Переходы в пару десятков метров - это та же остановка через дорогу, отдельным шагом их не показываем. */
export const MIN_WALK_TO_SHOW_M = 40;

/**
 * Шаги варианта, которые видит пассажир, - индексы в journey.legs. Общие для списка шагов,
 * навигатора и подсветки этапа на карте, чтобы номер шага везде значил одно и то же.
 */
export const visibleLegIndices = (journey: PlannedJourney) =>
    journey.legs
        .map((leg, index) => ({ leg, index }))
        .filter(
            ({ leg }) =>
                leg.kind === 'ride' ||
                leg.meters >= MIN_WALK_TO_SHOW_M ||
                // Путь от своего места до остановки показываем всегда, даже если она у подъезда.
                isPlaceId(leg.from) ||
                isPlaceId(leg.to) ||
                // Спуститься в метро и выйти из него - отдельные шаги, даже если вход рядом.
                isMetroStop(leg.from) ||
                isMetroStop(leg.to),
        )
        .map(({ index }) => index);

/** Шаги навигатора: видимые этапы и последний - «вы на месте» (null). */
export const navigationSteps = (journey: PlannedJourney): (number | null)[] => [
    ...visibleLegIndices(journey),
    null,
];
