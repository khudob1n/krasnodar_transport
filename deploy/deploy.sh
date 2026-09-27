#!/usr/bin/env bash
# Выкладка на сервер одной командой (запускается на компьютере разработчика):
#   ./deploy/deploy.sh            - код, сборка, перезапуск служб
#   ./deploy/deploy.sh --with-db  - то же и заменить базу админки на сервере локальной
# При первом запуске база заливается сама. Файлы .env на сервере не трогаются -
# они создаются вручную при первой настройке сервера.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/deploy/config.sh"

# Одно SSH-соединение на весь деплой: частые новые подключения сервер иногда обрывает.
SSH_OPTS="-o BatchMode=yes -o ControlMaster=auto -o ControlPath=/tmp/krd-ssh-%r@%h:%p -o ControlPersist=10m -o ServerAliveInterval=30"
ssh() { command ssh $SSH_OPTS "$@"; }
export RSYNC_RSH="ssh $SSH_OPTS"

WITH_DB=0
[ "${1:-}" = "--with-db" ] && WITH_DB=1

echo "→ Код на $SERVER:$APP_DIR"
rsync -az --delete \
    --exclude '.git' --exclude 'node_modules' --exclude '.next' \
    --exclude '.env' --exclude '.env.*' --exclude '*.tmp.mjs' \
    --exclude '/server/var/' --exclude '/admin/api/prisma/var/' \
    --exclude '/admin/web/' --exclude '/design/' --exclude '/passenger/archive-nuxt-web/' \
    --exclude '.DS_Store' --exclude '.claude' --exclude '/android/' \
    "$ROOT/" "$SERVER:$APP_DIR/"

if [ "$WITH_DB" = 1 ] || ! ssh "$SERVER" "test -f $APP_DIR/admin/api/prisma/var/admin.db"; then
    echo "→ База админки"
    ssh "$SERVER" "mkdir -p $APP_DIR/admin/api/prisma/var"
    # Снимок через .backup, а не копия файла: база может быть открыта локальной админкой.
    sqlite3 "$ROOT/admin/api/prisma/var/admin.db" ".backup '/tmp/krd-admin.db'"
    rsync -az /tmp/krd-admin.db "$SERVER:$APP_DIR/admin/api/prisma/var/admin.db"
    rm -f /tmp/krd-admin.db
fi

echo "→ Сборка и перезапуск"
ssh "$SERVER" bash -s <<REMOTE
set -euo pipefail
chown -R $APP_USER:$APP_USER $APP_DIR
as_app() { runuser -u $APP_USER -- env HOME=/home/$APP_USER bash -c "\$1"; }

as_app 'cd $APP_DIR/server && npm ci --omit=dev --no-audit --no-fund'
as_app 'cd $APP_DIR/admin/api && npm ci --no-audit --no-fund && node_modules/.bin/prisma generate'

# API должен работать до сборки сайта: Next при сборке берёт из него статьи для главной.
systemctl restart krd-proxy krd-admin-api
for i in \$(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:8090/ && break; sleep 1; done

as_app 'cd $APP_DIR/passenger && pnpm install --frozen-lockfile && NODE_OPTIONS=--max-old-space-size=1536 pnpm -r build'
systemctl restart krd-web
REMOTE

echo "→ Проверка"
for i in $(seq 1 30); do
    if curl -fsS -o /dev/null "https://$DOMAIN/map" 2>/dev/null || curl -fsS -o /dev/null "http://$DOMAIN/map" 2>/dev/null; then
        break
    fi
    sleep 2
done
curl -fsS -o /dev/null -w "сайт: %{http_code}\n" "http://$DOMAIN/map" -L
curl -fsS -o /dev/null -w "машины: %{http_code}\n" "http://$DOMAIN/api/app/live/vehicles" -L
echo "Готово: https://$DOMAIN"
