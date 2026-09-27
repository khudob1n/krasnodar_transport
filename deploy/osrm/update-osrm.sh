#!/usr/bin/env bash
# Пешеходный роутинг (OSRM, профиль foot) для маршрутов «от двери до двери».
# Запускается на компьютере разработчика (нужен osmium: brew install osmium-tool):
#   ./deploy/osrm/update-osrm.sh
# Скачивает выгрузку OSM по ЮФО, обрезает до Краснодара с пригородами (на 2 ГБ сервера
# osmium с целым округом не справляется) и отдаёт серверу, где setup-osrm.sh собирает граф
# и перезапускает службу. Повторный запуск - обновление карты.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/deploy/config.sh"

PBF_URL=https://download.geofabrik.de/russia/south-fed-district-latest.osm.pbf
# Запад, юг, восток, север: город, Яблоновский, Новознаменский, Пашковский, аэропорт.
# Та же рамка - BBOX в passenger/client/services/journey/places.ts.
BBOX=38.80,44.95,39.25,45.20

SSH_OPTS="-o BatchMode=yes -o ControlMaster=auto -o ControlPath=/tmp/krd-ssh-%r@%h:%p -o ControlPersist=10m -o ServerAliveInterval=30"
ssh() { command ssh $SSH_OPTS "$@"; }
export RSYNC_RSH="ssh $SSH_OPTS"

command -v osmium >/dev/null || { echo 'Нужен osmium: brew install osmium-tool' >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "→ Выгрузка OSM"
curl -fL --retry 3 -o "$WORK/region.osm.pbf" "$PBF_URL"
osmium extract --bbox "$BBOX" --strategy complete_ways "$WORK/region.osm.pbf" -o "$WORK/krd.osm.pbf"
ls -lh "$WORK/krd.osm.pbf"

echo "→ На сервер"
rsync -az "$ROOT/deploy/" "$SERVER:$APP_DIR/deploy/" --exclude .DS_Store
ssh "$SERVER" "mkdir -p /var/lib/krd-osrm/build"
rsync -az "$WORK/krd.osm.pbf" "$SERVER:/var/lib/krd-osrm/build/krd.osm.pbf"

echo "→ Сборка графа на сервере"
ssh "$SERVER" "bash $APP_DIR/deploy/osrm/setup-osrm.sh"
