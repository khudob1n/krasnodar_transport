// Вид транспорта встречается в данных в двух формах: Транспорт в реальном времени с портала отдаёт
// короткие коды (raw.rtype: "А"/"Тм"/"Тб"), а справочные датасеты (routes.json и т.д.) -
// полные слова ("Автобус"/"Трамвай"/"Троллейбус"). normalizeRouteType понимает обе формы.
// Цвета и иконки — официальные, из дизайн-кода Екатеринбурга (перешли из проекта-родителя) (design/icons/transport/*.svg).
export type RouteTypeCode = 'А' | 'Тм' | 'Тб';

const CANON: Record<string, RouteTypeCode> = {
  А: 'А',
  Автобус: 'А',
  Тм: 'Тм',
  Трамвай: 'Тм',
  Тб: 'Тб',
  Троллейбус: 'Тб',
};

export const ROUTE_TYPE_LABEL: Record<RouteTypeCode, string> = {
  А: 'Автобус',
  Тм: 'Трамвай',
  Тб: 'Троллейбус',
};

export const ROUTE_TYPE_COLOR: Record<RouteTypeCode, string> = {
  А: '#26a63f',
  Тм: '#ef7f1a',
  Тб: '#199ed9',
};

export const ROUTE_TYPE_ICON: Record<RouteTypeCode, string> = {
  А: '/design/icons/bus.svg',
  Тм: '/design/icons/tram.svg',
  Тб: '/design/icons/trol.svg',
};

export function normalizeRouteType(value: string): RouteTypeCode | null {
  return CANON[value] ?? null;
}
export function routeTypeLabel(value: string): string {
  const code = normalizeRouteType(value);
  return code ? ROUTE_TYPE_LABEL[code] : value;
}
export function routeTypeColor(value: string): string {
  const code = normalizeRouteType(value);
  return code ? ROUTE_TYPE_COLOR[code] : '#888888';
}
export function routeTypeIcon(value: string): string | null {
  const code = normalizeRouteType(value);
  return code ? ROUTE_TYPE_ICON[code] : null;
}
