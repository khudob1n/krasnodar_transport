// Та же карта, что на пассажирском сайте (тайлы OpenFreeMap в оформлении карты Екатеринбурга,
// см. passenger/tools/build-map-style.py - он же пишет этот файл) - лежит в
// public/map-style-light.json: светлая тема passenger/client/public/map-style-light.json,
// только со шрифтом Noto Sans от самого OpenFreeMap.
export const MAP_STYLE = '/map-style-light.json';

// MapLibre uses [lng, lat] order (GeoJSON convention) - opposite of Leaflet's [lat, lng].
export const CITY_CENTER: [number, number] = [38.9753, 45.0355];
