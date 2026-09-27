#!/usr/bin/env bash
# Однократная подготовка чистого сервера Ubuntu 24.04 (запускается на сервере от root,
# повторный запуск безопасен): пакеты, Node, пользователь, подкачка, файрвол, службы, nginx.
# HTTPS-сертификат выпускается один раз вручную (certbot --nginx), дальше продлевается сам.
set -euo pipefail

source "$(dirname "$0")/config.sh"

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q nginx certbot python3-certbot-nginx rsync sqlite3 curl ca-certificates ufw

# Подкачка 2 ГБ: сборке Next.js на 2 ГБ памяти иначе не хватает.
if ! swapon --show | grep -q /swapfile; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    sysctl -w vm.swappiness=10
    echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi

# Node.js из NodeSource и pnpm той же версии, что на компьютере разработчика.
if ! node -v 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y -q nodejs
fi
npm install -g "pnpm@${PNPM_VERSION}" >/dev/null

# Приложение работает от отдельного пользователя без входа в систему.
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" "$BACKUP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$BACKUP_DIR"

# Наружу открыты только SSH и веб. Порты 8080/8090/3100 доступны лишь nginx на самом сервере.
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

# Службы и nginx - из файлов деплоя, которые deploy.sh уже положил в $APP_DIR/deploy.
install -m 644 "$APP_DIR"/deploy/systemd/*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable krd-proxy krd-admin-api krd-web >/dev/null
# Пешеходный роутинг (krd-osrm) ставится отдельно, с компьютера: ./deploy/osrm/update-osrm.sh

sed "s/__DOMAIN__/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/krd
ln -sf /etc/nginx/sites-available/krd /etc/nginx/sites-enabled/krd
rm -f /etc/nginx/sites-enabled/default
# Конфиг выше - без HTTPS. Если сертификат уже выпущен, certbot снова подключает его к конфигу.
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    certbot install --nginx -d "$DOMAIN" --cert-name "$DOMAIN" --redirect --non-interactive
    # HTTP/2: карта шлёт много запросов разом, по HTTP/1.1 это отдельные соединения на каждый.
    sed -i -E 's/listen (\[::\]:)?443 ssl( ipv6only=on)?;/listen \1443 ssl http2\2;/' /etc/nginx/sites-available/krd
fi
nginx -t
systemctl reload nginx

# Ежедневный бэкап базы админки в 04:00, хранятся последние 14.
cat > /etc/cron.d/krd-backup <<CRON
0 4 * * * $APP_USER sqlite3 $APP_DIR/admin/api/prisma/var/admin.db ".backup '$BACKUP_DIR/admin-\$(date +\%F).db'" && find $BACKUP_DIR -name 'admin-*.db' -mtime +14 -delete
CRON

echo 'Сервер подготовлен.'
