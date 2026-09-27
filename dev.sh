#!/usr/bin/env bash
# Поднимает весь стек локально: прокси-сервер, API админки, UI админки и пассажирское приложение.
# Ctrl+C останавливает всё разом.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BLUE=$'\033[34m'
MAGENTA=$'\033[35m'; CYAN=$'\033[36m'; BOLD=$'\033[1m'; RESET=$'\033[0m'

die() { printf '%s%s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }
info() { printf '%s%s%s\n' "$BOLD" "$*" "$RESET"; }

need_dir() {
    [ -d "$ROOT/$1/node_modules" ] || die "Нет зависимостей в $1. Установить: (cd $1 && $2)"
}

need_file() {
    [ -f "$ROOT/$1" ] || die "Нет файла $1. $2"
}

info 'Проверяю окружение...'

command -v node >/dev/null || die 'Не найден node.'
command -v curl >/dev/null || die 'Не найден curl.'
command -v pnpm >/dev/null || die 'Не найден pnpm (нужен для passenger/). Установить: npm i -g pnpm'

need_dir server 'npm install'
need_dir admin/api 'npm install'
need_dir admin/web 'npm install'
need_dir passenger/client 'cd .. && pnpm install'

need_file server/.env 'Скопировать: cp server/.env.example server/.env'
need_file admin/api/.env 'Скопировать: cp admin/api/.env.example admin/api/.env'
need_file admin/web/.env 'Скопировать: cp admin/web/.env.example admin/web/.env'
need_file passenger/client/.env.local 'Создать с NEXT_PUBLIC_ADMIN_API_URL=http://localhost:8090'
need_file admin/api/prisma/var/admin.db \
    'База не создана. Выполнить: (cd admin/api && npm run migrate && npm run seed)'

# Порты заняты — почти всегда это забытый прошлый запуск, молча стартовать поверх нельзя.
for entry in '8080:прокси-сервер' '8090:API админки' '3000:UI админки' '3100:пассажирское приложение'; do
    port="${entry%%:*}"
    if lsof -ti "tcp:$port" >/dev/null 2>&1; then
        die "Порт $port уже занят (${entry#*:}). Освободить: kill \$(lsof -ti tcp:$port)"
    fi
done

# Всё, что запустим, живёт в группе процессов этого скрипта — Ctrl+C гасит стек целиком.
cleanup() {
    trap - INT TERM EXIT
    printf '\n%sОстанавливаю сервисы...%s\n' "$BOLD" "$RESET"
    kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

run_service() {
    local name="$1" color="$2" dir="$3"; shift 3
    (
        cd "$ROOT/$dir"
        "$@" 2>&1 | while IFS= read -r line; do
            printf '%s[%-10s]%s %s\n' "$color" "$name" "$RESET" "$line"
        done
    ) &
}

wait_port() {
    local port="$1" name="$2" tries=0
    # Через curl, а не /dev/tcp: Nuxt слушает только IPv6-loopback, и стук в 127.0.0.1 его не видит.
    # Любой HTTP-ответ (в том числе 404 на «/») считаем признаком того, что сервис поднялся.
    until curl -s -o /dev/null --max-time 2 "http://localhost:$port/" >/dev/null 2>&1; do
        tries=$((tries + 1))
        [ "$tries" -lt 240 ] || die "$name не поднялся на :$port за 120с."
        sleep 0.5
    done
    printf '%s  ✓ %s → http://localhost:%s%s\n' "$GREEN" "$name" "$port" "$RESET"
}

# Прокси-сервер первый: админка читает через него живые данные и историю.
info $'\nЗапускаю прокси-сервер...'
run_service server "$CYAN" server npm run dev
wait_port 8080 'прокси-сервер'

info 'Запускаю API админки...'
run_service admin-api "$MAGENTA" admin/api npm run dev
wait_port 8090 'API админки'

info 'Запускаю фронтенды...'
run_service admin-web "$YELLOW" admin/web npm run dev
run_service passenger "$BLUE" passenger/client pnpm dev
wait_port 3000 'UI админки'
wait_port 3100 'пассажирское приложение'

cat <<EOF

${BOLD}Всё поднято:${RESET}
  Пассажирское приложение  http://localhost:3100
  Админка (UI)             http://localhost:3000
  API админки              http://localhost:8090
  Прокси-сервер            http://localhost:8080

Ctrl+C — остановить всё.
EOF

wait
