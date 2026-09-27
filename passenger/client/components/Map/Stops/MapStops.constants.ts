export const VISISBILITY_MINIMAL_ZOOM = 13;

export { LABELS_MINIMAL_ZOOM } from '../mapDensity';

// Остановки одного узла обычно разнесены по разным сторонам дороги. Маркеры у них остаются
// отдельными, но в пределах этого расстояния одинаковое название показываем только один раз.
export const STOP_LABEL_GROUP_RADIUS_METERS = 100;

// Небольшой зазор между подписями нужен, чтобы обводки букв визуально не слипались.
export const STOP_LABEL_COLLISION_PADDING_PX = 6;
