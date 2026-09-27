// Какие поля датасета получают отдельный фильтр в UI (список значений тянется с бэкенда
// через /facets, поэтому значения и счётчики всегда актуальны). Свободный текстовый поиск
// по всей записи доступен для всех датасетов и так, отдельно объявлять не нужно.
//
// kind:
//  - 'chips-icon' - вид транспорта: чипы с официальными пиктограммами автобуса/трамвая/троллейбуса
//  - 'chips'      - маленький список значений (обычно ≤10) - чипы без иконки
//  - 'select'     - большой список значений (сотни) - выпадающий список
export type FilterKind = 'chips-icon' | 'chips' | 'select';
export type FilterDef = { field: string; label: string; kind: FilterKind; groupIcon?: string };

export const COLLECTION_FILTERS: Record<string, FilterDef[]> = {
  'ground_transport/routes': [{ field: 'type', label: 'Вид транспорта', kind: 'chips-icon' }],
  'ground_transport/route_stops': [{ field: 'type', label: 'Вид транспорта', kind: 'chips-icon' }],
  'ground_transport/route_geometry': [{ field: 'routeShortName', label: 'Маршрут', kind: 'select', groupIcon: 'map' }],
  'ground_transport/schedule_trips': [
    { field: 'route_type', label: 'Вид транспорта', kind: 'chips-icon' },
    { field: 'day_type', label: 'Тип дня', kind: 'chips', groupIcon: 'clock' },
  ],
  'ground_transport/schedule_intervals': [
    { field: 'route_type', label: 'Вид транспорта', kind: 'chips-icon' },
    { field: 'day_type', label: 'Тип дня', kind: 'chips', groupIcon: 'clock' },
  ],
  'metro/entrances': [
    { field: 'station_name', label: 'Станция', kind: 'chips', groupIcon: 'pin-marker' },
    { field: 'wheelchair_access', label: 'Доступ для колясок', kind: 'chips', groupIcon: 'accessible' },
  ],
  'metro/weekend_schedule': [
    { field: 'station', label: 'Станция', kind: 'chips', groupIcon: 'pin-marker' },
    { field: 'direction_to', label: 'Направление', kind: 'chips', groupIcon: 'map' },
  ],
};
