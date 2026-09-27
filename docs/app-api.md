# API сайта для мобильного приложения

Всё, что нужно приложению, отдаётся с одного адреса — домена сайта:

| Среда | Базовый адрес |
|---|---|
| Прод | `https://krasnodar-transport.khudob1n.ru` |
| Разработка, эмулятор | `http://127.0.0.1:3300` — локальный сайт (`krd-passenger`) через `adb reverse tcp:3300 tcp:3300`: на Android 17 приложению закрыт доступ в локальную сеть, в том числе к `10.0.2.2` |

На проде пути раздаёт nginx (`deploy/nginx.conf`), в разработке — `rewrites()` в
`passenger/client/next.config.js`. Все запросы — GET, без авторизации. Завершающий `/` в путях
не ставить: Next отвечает на него редиректом.

## Справочники и расписания — `/api/app/collections`

Данные админки (`admin/api/src/lib/collections.js`), только чтение.

### Список коллекций и их версии

`GET /api/app/collections`

```json
{ "collections": [
  { "key": "ground_transport/routes", "label": "Маршруты (наземный транспорт)", "single": false,
    "count": 39, "updatedAt": "2026-09-25T18:34:32.890Z" }
] }
```

`count` и `updatedAt` — версия коллекции: приложение перекачивает коллекцию, только если одно из
них изменилось.

### Записи

`GET /api/app/collections/{namespace}/{name}/records?page=1&pageSize=500&filters={json}`

- `pageSize` — не больше 500; всю коллекцию забирать по страницам, пока не наберётся `total`.
- `filters` — JSON с точным совпадением полей записи: `{"stop_id": 181}`.

```json
{ "collection": { "key": "ground_transport/stops", "label": "…", "single": false },
  "page": 1, "pageSize": 500, "total": 859,
  "records": [ { "id": "…", "recordKey": "100", "updatedAt": "…",
                 "data": { "id": 100, "name": "ул.Уральская", "direction": 0, "lat": 45.02997, "lng": 39.02807 } } ] }
```

Полезная нагрузка — `records[].data`. Коллекции:

| Коллекция | Запись (`data`) | Объём |
|---|---|---|
| `ground_transport/routes` | `id, type ("Трамвай"/"Троллейбус"/"Автобус"), number, shortName, name, fromStation, toStation, companyName` | 39 |
| `ground_transport/route_stops` | маршрут + `directions[]: { subrouteId, directionTo, forward, stopsCount, stations[]: {id, name, lat, lng} }` — основные направления первыми | 39 |
| `ground_transport/route_geometry` | `routeId, subrouteId, directionName, forward, approximate, points[]: {lat, lng}` | 278 |
| `ground_transport/stops` | `id, name, direction, lat, lng` | 859 |
| `ground_transport/schedule_trips` | `stop_id, stop_name, route_number, route_type, route_shortName, day_type ("будни"/"выходные"), time ("HH:MM"), to_station` | ~350 тыс. — только по остановке, `filters={"stop_id":…}` |
| `ground_transport/depots` | `id, name, type ("tram"/"troll"/"bus"), operator, polygons[][]: [lat, lng]` | 4 |
| `rail/stations` | `id, name, kind ("railway_station"/"bus_terminal"/"airport"), description, lat, lng` | 5 |
| `site/home_cards` | карточки главной: `id, type, title, url, size?, footerCaption?, dynamicId?` | 4 |
| `site/faq_articles` | статьи: `slug, title, order, body` (markdown, `[[legend]]` — место условных обозначений) | 3 |

id маршрута — FNV-1a от «Тм|1», «Тб|2», «А|96» (`data/import_kttu.mjs`), тот же у живых машин.

## Живые данные — `/api/app/live`

### Машины

`GET /api/app/live/vehicles` → `{ "vehicles": [ … ] }`, обновлять раз в 5–10 с.

```json
{ "deviceCode": "f3f6c107-…", "gosNum": "АК 817 23", "routeId": 2625818258, "subrouteId": 268,
  "routeType": "А", "routeNumber": "96", "lat": 45.063973, "lng": 39.016498,
  "speed": null, "dir": 358, "navTime": "2026-09-26T16:08:51.821Z", "lowFloor": true,
  "model": "МАЗ-206.086", "operator": "КТТУ, ТД1", "boardNumber": "475",
  "from": "Центральный колхозный рынок", "to": "городская психиатрическая больница" }
```

- `routeType`: `"А"` автобус, `"Тб"` троллейбус, `"Тм"` трамвай.
- `subrouteId` — направление из `route_stops`; `0`, если машина не на линии маршрута (в депо, по изменённой схеме).
- `speed` — всегда `null`: источник скорость не отдаёт, спидометр не показывать.
- `navTime` — когда машина последний раз сдвинулась (UTC); старше 5 минут — «устаревшая», как на сайте.

### Пробки

`GET /api/app/live/traffic` → `{ "level": 2, "color": "green", "hint": "Дороги почти свободны", "trend": 0, "updatedAt": "…", "url": "…" }`

### Табло вокзалов

`GET /api/app/live/rail/schedule?…` — параметры как у сайта (`api/ekb/collections.ts`, `fetchRailSchedule`). Пока не работает: нужен ключ Яндекс.Расписаний.

## Поиск адресов — `/api/geocode`

- `GET /api/geocode?q=Красная 122` → `{ "places": [ { "title": "Красная улица, 122", "subtitle": "Адрес", "lat": 45.034819, "lng": 38.975028 } ] }`
- `GET /api/geocode/reverse?lat=…&lng=…` — ближайший адрес.

## Пешие участки — `/api/walk`

OSRM с профилем `foot`: `GET /api/walk/route/v1/foot/{lng,lat;lng,lat}?overview=full&geometries=geojson`
и `GET /api/walk/table/v1/foot/{координаты}?sources=0` — формат OSRM как есть.

## Отчёты о сбоях — `/api/app/crash-reports`

`POST /api/app/crash-reports`, тело — JSON, до 64 КБ, с одного адреса не чаще ~6 в минуту:

```json
{ "kind": "crash", "happenedAt": "2026-09-27T05:23:47Z", "appVersion": "0.1.0 (1)",
  "androidVersion": "17", "device": "Google Pixel 8", "thread": "main", "stack": "…" }
```

`kind` — `crash` или `anr`, `stack` обязателен (обрезается до 16 000 символов). Ответ `204`.
Персональных данных не отправлять. На сервере отчёты — строками JSON в
`/opt/krd/admin/api/prisma/var/crashes.jsonl` (`tail -n 50 … | jq .`).

## Правила совместимости

Выпущенные версии приложения живут долго, поэтому:

- поля в ответах можно **добавлять**, но не переименовывать и не удалять;
- смена смысла поля или формата — новая коллекция или новый путь, старый остаётся до ухода старых версий;
- приложение игнорирует незнакомые поля и не падает на незнакомых значениях (`routeType`, `kind`).
