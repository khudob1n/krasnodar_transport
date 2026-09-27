import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signSession, sessionCookieOptions } from '../lib/auth.js';
import { serializeCookie } from '../lib/cookies.js';
import { config } from '../lib/config.js';

export const authRouter = Router();

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role };
}

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = await signSession(user);
  res.setHeader('Set-Cookie', serializeCookie(config.jwtCookieName, token, sessionCookieOptions));
  res.json({ user: publicUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', serializeCookie(config.jwtCookieName, '', { ...sessionCookieOptions, maxAge: 0 }));
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Не авторизован' });
  res.json({ user: publicUser(req.user) });
});
