const { version } = require('./package.json');

// Дата обновления справочников для экрана настроек (TASK-206): самая свежая last_fetched из
// data/manifest.json. Читаем при сборке - в браузер попадает только строка с датой.
function dataUpdatedAt() {
    try {
        const { datasets } = require('../../data/manifest.json');
        const dates = Object.values(datasets)
            .map((dataset) => dataset.last_fetched)
            .filter((date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date));

        return dates.sort().pop() || '';
    } catch (e) {
        return '';
    }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: version,
        NEXT_PUBLIC_DATA_UPDATED_AT: dataUpdatedAt(),
    },
    reactStrictMode: true,
    swcMinify: true,
    // Next 14.2.6 -> ESLint 9 в devDependencies референса несовместимы (Next тут использует
    // legacy ESLint API, которого в 9 больше нет) - это их версии, не наш код, поэтому
    // просто не гоняем линт как часть build (можно чинить версии отдельно от переноса данных).
    eslint: {
        ignoreDuringBuilds: true,
    },
    webpack(config) {
        config.module.rules.push({
            test: /\.svg$/i,
            issuer: /\.[jt]sx?$/,
            use: [
                {
                    loader: '@svgr/webpack',
                    options: {
                        svgoConfig: {
                            plugins: [
                                {
                                    name: 'preset-default',
                                    params: {
                                        // SVGO по умолчанию срезает viewBox. Без него система
                                        // координат иконки становится 1:1 с пикселями, и когда
                                        // CSS задаёт размер меньше исходного, лишнее просто
                                        // обрезается (крестик в модалке терял половину).
                                        overrides: { removeViewBox: false },
                                    },
                                },
                            ],
                        },
                    },
                },
            ],
        });

        return config;
    },
    // Пешеходный роутинг (OSRM) на проде отдаёт nginx по /api/walk/. При локальной разработке
    // своего OSRM нет - ходим через Next (чтобы не упереться в CORS) в публичный пешеходный
    // OSRM FOSSGIS: у Краснодара прода с /api/walk пока нет. WALK_ROUTER_URL - любой OSRM
    // с профилем foot, например https://krasnodar-transport.khudob1n.ru/api/walk.
    async rewrites() {
        if (process.env.NODE_ENV === 'production') return [];
        const target = process.env.WALK_ROUTER_URL || 'https://routing.openstreetmap.de/routed-foot';
        // Геокодер - в локальном прокси (server/, порт 8080), индекс тот же, что на проде.
        const proxy = process.env.PROXY_URL || 'http://localhost:8080';
        const adminApi = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:8090';
        return [
            { source: '/api/walk/:path*', destination: `${target}/:path*` },
            { source: '/api/geocode', destination: `${proxy}/geocode` },
            { source: '/api/geocode/reverse', destination: `${proxy}/geocode/reverse` },
            // API для мобильного приложения - на проде nginx отдаёт /api/app/ с того же домена;
            // в разработке так же, чтобы приложению хватало одного адреса (сайта).
            { source: '/api/app/:path*', destination: `${adminApi}/api/app/:path*` },
        ];
    },
    transpilePackages: ['transport-common'],
    images: {
        unoptimized: true,
    },
};

module.exports = nextConfig;
