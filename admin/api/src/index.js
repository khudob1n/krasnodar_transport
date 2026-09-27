import express from 'express';
import { config } from './lib/config.js';
import { attachUser } from './middleware/requireAuth.js';
import { attachAppUser } from './middleware/requireAppAuth.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { liveRouter } from './routes/live.js';
import { historyRouter } from './routes/history.js';
import { collectionsRouter } from './routes/collections.js';
import { appAuthRouter } from './routes/appAuth.js';
import { favoritesRouter } from './routes/favorites.js';
import { publicCollectionsRouter } from './routes/publicCollections.js';
import { publicLiveRouter } from './routes/publicLive.js';
import { crashReportsRouter } from './routes/crashReports.js';

const app = express();
const allowedOrigins = new Set([config.webOrigin, config.appOrigin]);

// Отчёт о сбое - до ~16 КБ стека; остальные запросы маленькие.
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(attachUser);
app.use(attachAppUser);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/live', liveRouter);
app.use('/api/history', historyRouter);
app.use('/api/collections', collectionsRouter);

// Passenger app (public site, separate origin/session from the admin panel above).
app.use('/api/app/auth', appAuthRouter);
app.use('/api/app/favorites', favoritesRouter);
app.use('/api/app/collections', publicCollectionsRouter);
app.use('/api/app/live', publicLiveRouter);
app.use('/api/app/crash-reports', crashReportsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(config.port, () => {
  console.log(`Admin API listening on http://localhost:${config.port}`);
});
