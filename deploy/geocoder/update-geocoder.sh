#!/usr/bin/env bash
# Индекс своего геокодера (data/geocoder/places.json) из свежей выгрузки OSM.
# Запускается на компьютере разработчика (нужен osmium: brew install osmium-tool):
#   ./deploy/geocoder/update-geocoder.sh
# Дальше - обычный ./deploy/deploy.sh: индекс лежит в data/, прокси (krd-proxy) читает его при старте.
# Обрезка выгрузки - здесь, а не на сервере: osmium с целым ЮФО съедает почти все 2 ГБ сервера.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PBF_URL=https://download.geofabrik.de/russia/south-fed-district-latest.osm.pbf
# Та же рамка, что у OSRM (deploy/osrm/update-osrm.sh) и BBOX в passenger/client/services/journey/places.ts.
BBOX=38.80,44.95,39.25,45.20

command -v osmium >/dev/null || { echo 'Нужен osmium: brew install osmium-tool' >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "→ Выгрузка OSM"
curl -fL --retry 3 -o "$WORK/region.osm.pbf" "$PBF_URL"
osmium extract --bbox "$BBOX" --strategy simple "$WORK/region.osm.pbf" -o "$WORK/krd.osm.pbf"
osmium tags-filter "$WORK/krd.osm.pbf" nwr/addr:housenumber nwr/name -o "$WORK/filtered.osm.pbf"
osmium export "$WORK/filtered.osm.pbf" -f geojsonseq -i sparse_file_array -a type,id \
    --geometry-types=point,linestring,polygon -o "$WORK/places.geojsonseq"

echo "→ Индекс"
mkdir -p "$ROOT/data/geocoder"
python3 "$ROOT/deploy/geocoder/build_places.py" "$WORK/places.geojsonseq" "$ROOT/data/geocoder/places.json"
