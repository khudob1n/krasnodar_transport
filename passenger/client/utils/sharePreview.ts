import { ADMIN_API_URL, SITE_URL } from 'transport-common/strapi/constants';

/**
 * Превью ссылок на карту (TASK-223): по параметрам ссылки (/map?stop=…, ?vehicle=…,
 * ?from=…&to=…) - заголовок, описание и содержимое картинки. Общее для мета-тегов страницы
 * карты (pages/map.tsx, на сервере) и генератора картинки (pages/api/og.tsx, edge) - поэтому
 * без зависимостей от Node и от клиента: только fetch к нашему API.
 *
 * Картинка строится по id объекта, а не по тексту из ссылки: иначе на нашем домене можно было
 * бы нарисовать любую надпись. Исключение - подпись точки на карте (адрес из поиска): её
 * больше неоткуда взять, она обрезается до 64 знаков.
 */

export type PreviewUnit = 'bus' | 'troll' | 'tram';

export interface SharePreview {
    title: string;
    description: string;
    /** Что это - мелко над названием на картинке. */
    label: string;
    /** Крупно на картинке. */
    heading: string;
    /** Строка под названием на картинке. */
    subheading?: string;
    /** Плашка маршрута на картинке. */
    chip?: { unit: PreviewUnit; num: string };
    /** Адрес картинки (абсолютный) - для og:image. */
    image: string;
}

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.slice(0, 64);

const UNIT_BY_RU: Record<string, PreviewUnit> = {
    Автобус: 'bus',
    Троллейбус: 'troll',
    Трамвай: 'tram',
};
const UNIT_BY_CODE: Record<string, PreviewUnit> = { А: 'bus', Тб: 'troll', Тм: 'tram' };
const UNIT_TITLE: Record<PreviewUnit, string> = {
    bus: 'Автобус',
    troll: 'Троллейбус',
    tram: 'Трамвай',
};

async function getJson<T>(path: string): Promise<T | null> {
    try {
        const response = await fetch(`${ADMIN_API_URL}${path}`, {
            signal: AbortSignal.timeout(4000),
        });
        return response.ok ? ((await response.json()) as T) : null;
    } catch {
        return null;
    }
}

async function record<T>(collection: string, filters: Record<string, string | number>) {
    const params = new URLSearchParams({ filters: JSON.stringify(filters), pageSize: '1' });
    const data = await getJson<{ records: { data: T }[] }>(
        `/api/app/collections/${collection}/records?${params.toString()}`,
    );
    return data?.records[0]?.data ?? null;
}

/** Название места маршрута: остановка, станция метро (id < 0) или точка на карте. */
async function placeName(value: string | undefined, label: string | undefined) {
    if (!value) return null;
    if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(value)) return label || 'Точка на карте';
    const id = Number(value);
    if (!Number.isFinite(id)) return null;
    if (id < 0) {
        const station = await record<{ name: string }>('metro/stations', { id: -id });
        return station ? `метро «${station.name}»` : null;
    }
    const stop = await record<{ name: string }>('ground_transport/stops', { id });
    return stop ? `«${stop.name}»` : null;
}

const imageUrl = (params: Record<string, string>) =>
    `${SITE_URL}/api/og?${new URLSearchParams(params).toString()}`;

/** Описание превью для ссылки на карту; null - обычная ссылка без объекта. */
export async function describeShare(query: Query): Promise<SharePreview | null> {
    const stopId = one(query.stop);
    const vehicleId = one(query.vehicle);
    const from = one(query.from);
    const to = one(query.to);

    if (stopId && /^\d+$/.test(stopId)) {
        const stop = await record<{ name: string }>('ground_transport/stops', { id: Number(stopId) });
        if (!stop) return null;
        return {
            title: `Остановка «${stop.name}» — Транспорт Краснодара`,
            description: `Что и когда придёт на остановку «${stop.name}»: прибытие транспорта в реальном времени и расписание.`,
            label: 'Остановка',
            heading: stop.name,
            subheading: 'Прибытие транспорта в реальном времени',
            image: imageUrl({ stop: stopId }),
        };
    }

    if (vehicleId && /^[\w-]+$/.test(vehicleId)) {
        const live = await getJson<{
            vehicles: { deviceCode: string; routeType: string; routeNumber: string; routeId: number }[];
        }>('/api/app/live/vehicles');
        const vehicle = live?.vehicles.find((item) => item.deviceCode === vehicleId);
        if (!vehicle) return null;
        const unit = UNIT_BY_CODE[vehicle.routeType] ?? 'bus';
        const route = await record<{ name: string; type: string }>('ground_transport/routes', {
            id: vehicle.routeId,
        });
        const name = `${UNIT_TITLE[unit]} ${vehicle.routeNumber}`;
        return {
            title: `${name} на карте — Транспорт Краснодара`,
            description: `Где сейчас ${name.toLowerCase()}${route ? ` (${route.name})` : ''} — в реальном времени на карте транспорта Краснодара.`,
            label: 'Где сейчас',
            heading: name,
            subheading: route?.name,
            chip: { unit: route ? (UNIT_BY_RU[route.type] ?? unit) : unit, num: vehicle.routeNumber },
            image: imageUrl({ vehicle: vehicleId }),
        };
    }

    if (from && to) {
        const [fromName, toName] = await Promise.all([
            placeName(from, one(query.fromName)),
            placeName(to, one(query.toName)),
        ]);
        if (!fromName || !toName) return null;
        const params: Record<string, string> = { from, to };
        // Подписи точек на карте (адреса) - только для них: у остановок название из данных.
        if (from.includes(',') && one(query.fromName)) params.fromName = one(query.fromName)!;
        if (to.includes(',') && one(query.toName)) params.toName = one(query.toName)!;
        return {
            title: `Как доехать: ${fromName} → ${toName}`,
            description: `Маршрут на транспорте Краснодара от ${fromName} до ${toName}: варианты с пересадками, время в пути и пешком.`,
            label: 'Маршрут',
            heading: `${fromName} → ${toName}`,
            subheading: 'Варианты с пересадками, время в пути и пешком',
            image: imageUrl(params),
        };
    }

    return null;
}
