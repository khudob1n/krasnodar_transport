import { SignJWT, jwtVerify } from 'jose';
import { config } from './config.js';

const secret = new TextEncoder().encode(config.jwtSecret);
const SESSION_TTL = '7d';

export async function signSession(user) {
  return new SignJWT({ sub: user.id, email: user.email, role: user.role, kind: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secret);
}

export async function verifySession(token) {
  const { payload } = await jwtVerify(token, secret);
  if (payload.kind !== 'admin') throw new Error('wrong session kind');
  return payload; // { sub, email, role, kind, iat, exp }
}

// Passenger app riders (AppUser) get their own signed session, kept distinct from admin
// sessions via `kind` even though both currently share the same signing secret - a rider's
// token can never be replayed against admin-only routes or vice versa.
export async function signAppSession(appUser) {
  return new SignJWT({ sub: appUser.id, email: appUser.email, kind: 'app' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secret);
}

export async function verifyAppSession(token) {
  const { payload } = await jwtVerify(token, secret);
  if (payload.kind !== 'app') throw new Error('wrong session kind');
  return payload; // { sub, email, kind, iat, exp }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
