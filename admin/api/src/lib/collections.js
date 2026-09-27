// Registry of the reference datasets under /data that the admin panel exposes as
// generic, editable collections. Each entry says which file seeds it and how to
// derive a stable `recordKey` for each row/entry in that file - used once by
// prisma/seed.mjs and to label things in the API/UI.
export const COLLECTIONS = [
  {
    key: 'ground_transport/routes',
    label: 'Маршруты (наземный транспорт)',
    file: 'ground_transport/routes.json',
    keyOf: (row) => String(row.id),
  },
  {
    key: 'ground_transport/stops',
    label: 'Остановки (наземный транспорт)',
    file: 'ground_transport/stops.json',
    keyOf: (row) => String(row.id),
  },
  {
    key: 'ground_transport/route_stops',
    label: 'Маршруты по остановкам',
    file: 'ground_transport/route_stops.json',
    keyOf: (row) => String(row.id),
  },
  {
    key: 'ground_transport/route_geometry',
    label: 'Геометрия маршрутов',
    file: 'ground_transport/route_geometry.json',
    keyOf: (row) => `${row.routeId}-${row.subrouteId}`,
  },
  {
    key: 'ground_transport/schedule_trips',
    label: 'Расписание по рейсам',
    file: 'ground_transport/schedule_trips.json',
    keyOf: (row, index) => `${row.stop_id}-${row.route_number}-${row.day_type}-${row.time}-${index}`,
  },
  {
    key: 'ground_transport/schedule_intervals',
    label: 'Расписание по интервалам',
    file: 'ground_transport/schedule_intervals.json',
    keyOf: (row, index) => `${row.stop_id}-${row.route_number}-${row.day_type}-${row.start_time}-${index}`,
  },
  {
    key: 'ground_transport/depots',
    label: 'Депо и автобусные парки',
    file: 'ground_transport/depots.json',
    keyOf: (row) => row.id,
  },
  {
    key: 'rail/stations',
    label: 'Железнодорожные станции и транспортные узлы',
    file: 'rail/stations.json',
    keyOf: (row) => String(row.id),
  },
  {
    key: 'metro/stations',
    label: 'Станции метро',
    file: 'metro/stations.json',
    keyOf: (row) => String(row.id),
  },
  {
    key: 'metro/entrances',
    label: 'Входы метро',
    file: 'metro/entrances.json',
    keyOf: (row) => String(row.id),
  },
  {
    key: 'metro/lines',
    label: 'Линии метро',
    file: 'metro/lines.json',
    // this file is a single object (line + directions), not a list - one record
    single: true,
    keyOf: () => 'lines',
  },
  {
    key: 'metro/schedule_info',
    label: 'Режим работы метро',
    file: 'metro/schedule_info.json',
    single: true,
    keyOf: () => 'schedule_info',
  },
  {
    key: 'metro/weekend_schedule',
    label: 'Расписание метро (выходные)',
    file: 'metro/weekend_schedule.json',
    keyOf: (row, index) => `${row.station}-${row.direction_to}-${row.time}-${index}`,
  },
  {
    key: 'site/home_cards',
    label: 'Карточки на главной (passenger-веб)',
    file: 'site/home_cards.json',
    keyOf: (row) => String(row.id),
  },
  {
    key: 'site/faq_articles',
    label: 'Статьи FAQ (passenger-веб)',
    file: 'site/faq_articles.json',
    keyOf: (row) => row.slug,
  },
];

export function findCollection(key) {
  return COLLECTIONS.find((c) => c.key === key);
}
