import { Router } from 'express';
import { appendFile, mkdir, stat, rename } from 'node:fs/promises';
import path from 'node:path';

// Отчёты о сбоях Android-приложения: падения и зависания. Приложение шлёт их при следующем
// запуске. Храним строками JSON в файле рядом с базой - смотреть на сервере:
//   tail -n 50 /opt/krd/admin/api/prisma/var/crashes.jsonl | jq .
// Персональных данных в отчёте нет: стек, версия приложения, Android и модель телефона.
export const crashReportsRouter = Router();

const FILE = path.resolve(import.meta.dirname, '../../prisma/var/crashes.jsonl');
// Файл больше 20 МБ уезжает в .1 (одна старая копия), чтобы не забить диск.
const MAX_BYTES = 20 * 1024 * 1024;
const LIMITS = { kind: 16, appVersion: 32, androidVersion: 16, device: 80, thread: 80, stack: 16_000 };

const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : undefined);

crashReportsRouter.post('/', async (req, res) => {
  const body = req.body ?? {};
  const kind = ['crash', 'anr'].includes(body.kind) ? body.kind : null;
  const stack = clip(body.stack, LIMITS.stack);
  if (!kind || !stack) return res.status(400).json({ error: 'Нужны kind (crash|anr) и stack' });

  const report = {
    receivedAt: new Date().toISOString(),
    happenedAt: clip(body.happenedAt, 40),
    kind,
    appVersion: clip(body.appVersion, LIMITS.appVersion),
    androidVersion: clip(body.androidVersion, LIMITS.androidVersion),
    device: clip(body.device, LIMITS.device),
    thread: clip(body.thread, LIMITS.thread),
    stack,
  };
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    const size = await stat(FILE).then((s) => s.size).catch(() => 0);
    if (size > MAX_BYTES) await rename(FILE, `${FILE}.1`);
    await appendFile(FILE, `${JSON.stringify(report)}\n`);
    res.status(204).end();
  } catch (err) {
    console.error('crash report', err);
    res.status(500).json({ error: 'Не удалось сохранить отчёт' });
  }
});
