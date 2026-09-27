import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signAppSession, sessionCookieOptions } from '../lib/auth.js';
import { serializeCookie } from '../lib/cookies.js';
import { config } from '../lib/config.js';

export const appAuthRouter = Router();

function publicAppUser(appUser) {
  return { id: appUser.id, email: appUser.email };
}

function setAppSessionCookie(res, token) {
  res.setHeader('Set-Cookie', serializeCookie(config.appJwtCookieName, token, sessionCookieOptions));
}

appAuthRouter.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await prisma.appUser.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const appUser = await prisma.appUser.create({ data: { email: normalizedEmail, passwordHash } });
  const token = await signAppSession(appUser);
  setAppSessionCookie(res, token);
  res.status(201).json({ user: publicAppUser(appUser) });
});

appAuthRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }

  const appUser = await prisma.appUser.findUnique({ where: { email: String(email).trim().toLowerCase() } });
  if (!appUser) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const ok = await bcrypt.compare(password, appUser.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = await signAppSession(appUser);
  setAppSessionCookie(res, token);
  res.json({ user: publicAppUser(appUser) });
});

appAuthRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', serializeCookie(config.appJwtCookieName, '', { ...sessionCookieOptions, maxAge: 0 }));
  res.json({ ok: true });
});

appAuthRouter.get('/me', (req, res) => {
  if (!req.appUser) return res.status(401).json({ error: 'Не авторизован' });
  res.json({ user: publicAppUser(req.appUser) });
});
