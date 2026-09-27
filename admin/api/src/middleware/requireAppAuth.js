import { config } from '../lib/config.js';
import { verifyAppSession } from '../lib/auth.js';
import { parseCookies } from '../lib/cookies.js';
import { prisma } from '../lib/prisma.js';

export async function attachAppUser(req, _res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[config.appJwtCookieName];
  if (!token) return next();

  try {
    const payload = await verifyAppSession(token);
    const appUser = await prisma.appUser.findUnique({ where: { id: payload.sub } });
    if (appUser) req.appUser = appUser;
  } catch {
    // invalid/expired token - treat as anonymous
  }
  next();
}

export function requireAppAuth(req, res, next) {
  if (!req.appUser) return res.status(401).json({ error: 'Не авторизован' });
  next();
}
