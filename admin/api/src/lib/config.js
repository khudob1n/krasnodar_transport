export const config = {
  port: Number(process.env.PORT || 8090),
  jwtSecret: process.env.JWT_SECRET,
  jwtCookieName: process.env.JWT_COOKIE_NAME || 'krd_admin_session',
  appJwtCookieName: process.env.APP_JWT_COOKIE_NAME || 'krd_app_session',
  proxyUrl: process.env.PROXY_URL || 'http://localhost:8080',
  // Admin panel and the public passenger app are separate Nuxt origins.
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:3000',
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:3001',
};

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is not set (see .env.example)');
}
