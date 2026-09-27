import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export const config = {
  port: Number(process.env.PORT || 8080),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 5000),
  historyRetentionDays: Number(process.env.HISTORY_RETENTION_DAYS || 14),

  yandexRasp: {
    apiKey: process.env.YANDEX_RASP_API_KEY || '',
    baseUrl: 'https://api.rasp.yandex-net.ru/v3.0',
    timeoutMs: 10_000,
    cacheTtlMs: 15 * 60 * 1000,
  },

  upstream: {
    // Живые позиции - API карты КТТУ (lite.krdpt.ru), см. upstreamClient.js.
    url: 'https://lite-api.krdpt.ru/v5/map/vehicles',
    timeoutMs: 10_000,
  },

  historyDir: path.join(ROOT, 'var', 'vehicle_history'),
};
