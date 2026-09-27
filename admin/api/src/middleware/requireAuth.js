import { config } from '../lib/config.js';
import { verifySession } from '../lib/auth.js';
import { parseCookies } from '../lib/cookies.js';
import { prisma } from '../lib/prisma.js';

export async function attachUser(req, _res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[config.jwtCookieName];
  if (!token) return next();

  try {
    const payload = await verifySession(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user && user.isActive) req.user = user;
  } catch {
    // invalid/expired token - treat as anonymous
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Не авторизован' });
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Не авторизован' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Недостаточно прав' });
    next();
  };
}
