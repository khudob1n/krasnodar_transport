// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false, // admin panel behind auth - no need to render on the server
  css: ['~/assets/global.css'],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8090',
    },
  },
  vite: {
    // maplibre-gl parses vector tiles in a Web Worker - Vite needs this to bundle/
    // resolve that worker correctly, otherwise tiles silently never render.
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['maplibre-gl'] },
  },
});
