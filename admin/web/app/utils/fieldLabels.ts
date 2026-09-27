// Русские подписи для полей справочных данных. Общий словарь покрывает большинство
// полей (многие имена повторяются между датасетами - id, name, lat/lng и т.д.),
// COLLECTION_FIELD_LABELS переопределяет там, где смысл поля в конкретном датасете уже
// стал понятен только по подписи по умолчанию (не переопределяем).
export const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  name: 'Название',
  type: 'Вид транспорта',
  number: 'Номер маршрута',
  shortName: 'Короткое имя',
  fromStation: 'Откуда',
  toStation: 'Куда',
  companyName: 'Перевозчик',
  direction: 'Направление (код)',
  lat: 'Широта',
  lng: 'Долгота',
  entrances_count: 'Входов',

  station_id: 'ID станции',
  station_name: 'Станция',
  entrance_number: 'Номер входа',
  wheelchair_access: 'Доступ для колясок',

  stop_id: 'ID остановки',
  stop_name: 'Остановка',
  route_number: 'Номер маршрута',
  route_type: 'Вид транспорта',
  route_shortName: 'Короткое имя маршрута',
  day_type: 'Тип дня',
  time: 'Время',
  to_station: 'Конечная',
  start_time: 'Начало интервала',
  end_time: 'Конец интервала',
  interval_min: 'Интервал, мин',

  routeId: 'ID маршрута',
  routeNumber: 'Номер маршрута',
  routeShortName: 'Короткое имя маршрута',
  subrouteId: 'ID подмаршрута',
  directionName: 'Направление',
  forward: 'Прямое направление',
  points: 'Точки маршрута (GPS)',

  station: 'Станция',
  direction_to: 'Направление на',
  hour: 'Час',
  minute: 'Минута',

  operating_hours: 'Часы работы',
  last_train: 'Время последнего поезда',
  intervals_weekday_min: 'Интервалы в будни, мин',
  intervals_weekend_min: 'Интервалы в выходные, мин',

  line: 'Линия',
  directions: 'Направления',
  stations: 'Станции',
  color: 'Цвет',
  source: 'Источник данных',
};

// Переопределения там, где общий словарь дал бы неверный/неточный смысл для конкретного датасета.
const COLLECTION_FIELD_LABELS: Record<string, Record<string, string>> = {
  'ground_transport/stops': {
    direction: 'Код направления',
  },
};

export function fieldLabel(collectionKey: string, field: string): string {
  return COLLECTION_FIELD_LABELS[collectionKey]?.[field] || FIELD_LABELS[field] || humanize(field);
}

function humanize(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
