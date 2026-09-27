import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import { useTheme } from 'components/ThemeProvider';
import { Basemap, useMapPreferences } from 'components/MapPreferencesProvider';

// Векторная карта: тайлы OpenFreeMap (tiles.openfreemap.org - OSM по схеме OpenMapTiles,
// бесплатно, без ключа, весь мир), оформленные как карта Екатеринбурга (map.ekaterinburg.city):
// те же слои, цвета и шрифт. Стили public/map-style-{light,dark}.json собирает
// tools/build-map-style.py - правки цветов делать там, а не в JSON.
// Переключаются вместе с темой интерфейса (components/ThemeProvider.tsx) через
// maplibregl.Map.setStyle() у уже созданной карты (а не пересоздание слоя на каждый тоггл -
// так было заметное мигание/гонка запросов). Подключена через @maplibre/maplibre-gl-leaflet,
// чтобы не переписывать весь Map/* (Marker/Polyline/controls) с Leaflet на голый MapLibre.
const STYLE_URL = {
    light: '/map-style-light.json',
    dark: '/map-style-dark.json',
};

// Упрощённая подложка (TASK-201): те же тайлы и цвета, но без зданий, номеров домов,
// землепользования и тропинок - остаются вода, зелень, дороги и их названия, и на этом фоне
// заметнее транспорт и остановки. Собирается из обычного style.json - отдельный файл на
// каждую тему не нужен.
const SIMPLE_HIDDEN_LAYERS = ['building', 'building_number', 'landuse_overlay', 'highway_dash'];

const styleCache: Record<string, Promise<any>> = {};

function loadStyle(theme: 'light' | 'dark', basemap: Basemap): Promise<any> | string {
    if (basemap === 'default') return STYLE_URL[theme];

    const key = `${theme}-${basemap}`;
    styleCache[key] ??= fetch(STYLE_URL[theme])
        .then((response) => {
            if (!response.ok) throw new Error(`style ${response.status}`);
            return response.json();
        })
        .then((style) => ({
            ...style,
            layers: style.layers.map((layer: any) =>
                SIMPLE_HIDDEN_LAYERS.includes(layer.id)
                    ? { ...layer, layout: { ...layer.layout, visibility: 'none' } }
                    : layer,
            ),
        }));
    // Сбой загрузки не запоминаем - иначе упрощённая подложка не появилась бы до перезагрузки.
    styleCache[key].catch(() => delete styleCache[key]);

    return styleCache[key];
}

export function MapVectorBasemap() {
    const map = useMap();
    const { theme } = useTheme();
    const { basemap } = useMapPreferences();
    const layerRef = useRef<any>(null);
    const themeRef = useRef(theme);

    useEffect(() => {
        // Первый стиль - всегда обычный URL: слой создаётся сразу, а упрощённый (если выбран)
        // подменяется эффектом ниже, как только загрузится.
        const layer = L.maplibreGL({ style: STYLE_URL[themeRef.current] });
        layer.addTo(map);
        layerRef.current = layer;

        return () => {
            map.removeLayer(layer);
            layerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- слой создаём один раз, тему дальше меняем через setStyle ниже
    }, [map]);

    useEffect(() => {
        themeRef.current = theme;
        let cancelled = false;
        const style = loadStyle(theme, basemap);

        Promise.resolve(style)
            .then((resolved) => {
                const glMap = layerRef.current?.getMaplibreMap?.();
                if (!cancelled && glMap) glMap.setStyle(resolved);
            })
            .catch((error) => console.warn('Не удалось загрузить стиль подложки', error));

        return () => {
            cancelled = true;
        };
    }, [theme, basemap]);

    return null;
}
