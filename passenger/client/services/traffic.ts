import { ADMIN_API_URL } from 'transport-common/strapi/constants';

/**
 * Балл пробок в Краснодаре для плашки на карте. Берёт его наш сервер (krd-proxy, из
 * информера Яндекса) и кэширует на 2 минуты - чаще спрашивать нет смысла.
 */

export const TRAFFIC_REFRESH_MS = 2 * 60 * 1000;

export interface Traffic {
    /** 0-10, как на Яндекс Картах. */
    level: number;
    color: 'green' | 'yellow' | 'red' | null;
    hint: string | null;
    /** -1 - пробки уменьшаются, 1 - растут. */
    trend: number;
}

export async function fetchTraffic(): Promise<Traffic> {
    const response = await fetch(`${ADMIN_API_URL}/api/app/live/traffic`);
    if (!response.ok) throw new Error(`traffic: HTTP ${response.status}`);
    return response.json();
}
