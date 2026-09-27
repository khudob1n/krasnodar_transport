#!/usr/bin/env bash
# Серверная часть пешеходного роутинга: собирает граф OSRM (профиль foot) из выгрузки
# /var/lib/krd-osrm/build/krd.osm.pbf и запускает службу krd-osrm. Выгрузку готовит и кладёт
# update-osrm.sh с компьютера разработчика - запускать нужно его, этот скрипт он вызывает сам.
# Сервис слушает только 127.0.0.1:5000, наружу его отдаёт nginx по /api/walk/.
set -euo pipefail

source "$(dirname "$0")/../config.sh"

OSRM_IMAGE=ghcr.io/project-osrm/osrm-backend:v5.27.1
OSRM_DIR=/var/lib/krd-osrm

test -f "$OSRM_DIR/build/krd.osm.pbf" || { echo "Нет $OSRM_DIR/build/krd.osm.pbf" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
command -v docker >/dev/null || apt-get install -y -q docker.io
systemctl enable --now docker >/dev/null

docker pull -q "$OSRM_IMAGE" >/dev/null
osrm() { docker run --rm -v "$OSRM_DIR/build:/data" "$OSRM_IMAGE" "$@"; }
osrm osrm-extract -p /opt/foot.lua /data/krd.osm.pbf
osrm osrm-partition /data/krd.osrm
osrm osrm-customize /data/krd.osrm
rm -f "$OSRM_DIR/build/krd.osm.pbf"

# Готовый граф подменяет рабочий целиком - служба не видит недописанных файлов.
systemctl stop krd-osrm 2>/dev/null || true
rm -rf "$OSRM_DIR/data"
mv "$OSRM_DIR/build" "$OSRM_DIR/data"

install -m 644 "$APP_DIR/deploy/systemd/krd-osrm.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable krd-osrm >/dev/null
systemctl restart krd-osrm

TEST="http://127.0.0.1:5000/route/v1/foot/38.9753,45.0355;38.9850,45.0400?overview=false"
for i in $(seq 1 60); do curl -fsS -o /dev/null "$TEST" 2>/dev/null && break; sleep 1; done
curl -fsS "$TEST" | head -c 300
echo
echo 'OSRM готов.'
