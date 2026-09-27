export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function serializeCookie(name, value, options = {}) {
  let str = `${name}=${encodeURIComponent(value)}`;
  if (options.maxAge != null) str += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
  if (options.path) str += `; Path=${options.path}`;
  if (options.httpOnly) str += '; HttpOnly';
  if (options.secure) str += '; Secure';
  if (options.sameSite) str += `; SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`;
  return str;
}
