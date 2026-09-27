# Транспорт Краснодара

Карта общественного транспорта Краснодара: трамваи, троллейбусы и автобусы в реальном времени,
расписания остановок, маршруты с пересадками. Сайт — https://krasnodar-transport.khudob1n.ru

- `passenger/` — пассажирский сайт (Next.js, Leaflet + MapLibre), форк проекта ekaterinburg.dev (MIT)
- `admin/` — админка и API справочников (Express, Prisma, SQLite)
- `server/` — прокси живых данных КТТУ, пробок, геокодер
- `android/` — приложение для Android (Kotlin, Jetpack Compose, MapLibre) — см. `android/README.md`
- `data/` — справочники: остановки, маршруты, расписания (proezd.kttu.ru), линии, вокзалы, депо
- `deploy/` — выкладка на сервер (`deploy/deploy.sh`)
- `docs/app-api.md` — API сайта для приложения

Секреты (`.env`, база админки, ключ подписи Android) в репозиторий не входят.
