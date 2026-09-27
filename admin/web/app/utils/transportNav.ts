// Sidebar navigation grouped by transport type rather than by raw dataset name - each
// ground-transport type gets the same shape of links (routes, its stops on the map,
// both schedule datasets), pre-filtered via query params the target pages read on load
// (see COLLECTION_FILTERS / the `filters` query-param handling in the records list page,
// and `stopType` handling in map.vue). Metro isn't split by type - it's already one mode.
//
// `query` is kept separate from `to` (rather than a single pre-joined URL) so the sidebar
// can highlight the *currently active* variant correctly - NuxtLink's built-in active-class
// matching only compares the route path, not the query string, so three links that only
// differ by `?type=...` would otherwise all show as active at once.
export type NavLink = { label: string; to: string; query?: Record<string, string> };
export type TransportNavGroup = { code: string; label: string; icon: string; links: NavLink[] };

function groundTransportGroup(code: string, fullType: string, label: string, icon: string): TransportNavGroup {
  return {
    code,
    label,
    icon,
    links: [
      { label: 'Маршруты', to: '/data/ground_transport/routes', query: { type: fullType } },
      { label: 'Остановки на карте', to: '/map', query: { stopType: code } },
      { label: 'Расписание по рейсам', to: '/data/ground_transport/schedule_trips', query: { route_type: fullType } },
      { label: 'Расписание по интервалам', to: '/data/ground_transport/schedule_intervals', query: { route_type: fullType } },
    ],
  };
}

export const TRANSPORT_NAV_GROUPS: TransportNavGroup[] = [
  groundTransportGroup('А', 'Автобус', 'Автобус', '/design/icons/bus.svg'),
  groundTransportGroup('Тб', 'Троллейбус', 'Троллейбус', '/design/icons/trol.svg'),
  groundTransportGroup('Тм', 'Трамвай', 'Трамвай', '/design/icons/tram.svg'),
];

export const METRO_NAV_LINKS: NavLink[] = [
  { label: 'Линии', to: '/data/metro/lines' },
  { label: 'Станции', to: '/data/metro/stations' },
  { label: 'Входы', to: '/data/metro/entrances' },
  { label: 'Режим работы', to: '/data/metro/schedule_info' },
  { label: 'Расписание (выходные)', to: '/data/metro/weekend_schedule' },
];
