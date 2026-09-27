<template>
  <div class="page">
    <aside class="panel card">
      <h1>Карта</h1>

      <div class="panel-section">
        <div class="section-title"><AppIcon name="pulse" :size="13" /> Транспорт в реальном времени</div>
        <label class="v-chip" :class="{ active: vehiclesAllOn }">
          <input type="checkbox" :checked="vehiclesAllOn" @change="toggleAll(vehicleTypesOn, redrawVehicles)" />
          <span class="all-dot"></span> Все
        </label>
        <label v-for="t in TYPE_OPTIONS" :key="'v' + t.code" class="v-chip" :class="{ active: vehicleTypesOn.has(t.code) }">
          <input type="checkbox" :checked="vehicleTypesOn.has(t.code)" @change="toggleSet(vehicleTypesOn, t.code, redrawVehicles)" />
          <img :src="t.icon" class="v-chip-icon" alt="" />
          {{ t.label }} <span class="count">{{ vehicleCountByType[t.code] || 0 }}</span>
        </label>
      </div>

      <div class="panel-section">
        <div class="section-title"><AppIcon name="pin-marker" :size="13" /> Остановки наземного транспорта</div>
        <label class="v-chip" :class="{ active: stopsAllOn }">
          <input type="checkbox" :checked="stopsAllOn" @change="toggleAll(stopTypesOn, redrawStops)" />
          <span class="all-dot"></span> Все
        </label>
        <label v-for="t in TYPE_OPTIONS" :key="'s' + t.code" class="v-chip" :class="{ active: stopTypesOn.has(t.code) }">
          <input type="checkbox" :checked="stopTypesOn.has(t.code)" @change="toggleSet(stopTypesOn, t.code, redrawStops)" />
          <img :src="t.icon" class="v-chip-icon" alt="" />
          {{ t.label }} <span class="count">{{ stopCountByType[t.code] || 0 }}</span>
        </label>
      </div>

      <div class="panel-section">
        <div class="section-title"><img src="/design/icons/metro.svg" class="section-icon" alt="" /> Метро</div>
        <label class="v-chip" :class="{ active: showMetroStations }">
          <input type="checkbox" v-model="showMetroStations" />
          <img src="/design/icons/metro.svg" class="v-chip-icon" alt="" /> Станции <span class="count">{{ metroStations.length }}</span>
        </label>
        <label class="v-chip" :class="{ active: showMetroEntrances }">
          <input type="checkbox" v-model="showMetroEntrances" />
          <img src="/design/icons/entrance.svg" class="v-chip-icon" alt="" /> Входы <span class="count">{{ metroEntrances.length }}</span>
        </label>
      </div>

      <div class="panel-section">
        <div class="section-title"><AppIcon name="map" :size="13" /> Геометрия маршрута</div>
        <RouteSearchPicker :routes="routes" v-model="selectedRouteId" @update:model-value="onRouteSelected" />
        <span v-if="geometryLoading" class="hint">Загрузка…</span>

        <template v-if="selectedRoute">
          <div v-if="selectedRoute" class="route-info">
            <img :src="routeTypeIcon(selectedRoute.type) ?? ''" alt="" />
            <div>
              <strong>{{ selectedRoute.shortName }}</strong> · {{ selectedRoute.name }}
              <div class="muted">{{ routeTypeLabel(selectedRoute.type) }} · {{ selectedRouteDirections.reduce((s, d) => s + d.stopsCount, 0) }} остановок</div>
            </div>
          </div>

          <div class="section-subtitle">Направление</div>
          <label
            v-for="d in selectedRouteDirections"
            :key="d.subrouteId"
            class="v-chip"
            :class="{ active: activeDirections.has(d.subrouteId) }"
          >
            <input type="checkbox" :checked="activeDirections.has(d.subrouteId)" @change="toggleSet(activeDirections, d.subrouteId, drawRouteGeometry)" />
            {{ d.forward ? '→' : '←' }} {{ d.directionTo }} <span class="count">{{ d.stopsCount }} ост.</span>
          </label>

          <label class="v-chip" :class="{ active: onlyRouteVehicles }">
            <input type="checkbox" v-model="onlyRouteVehicles" @change="redrawVehicles" />
            <AppIcon name="filter" :size="16" /> Только ТС этого маршрута
          </label>
        </template>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </aside>

    <div ref="mapEl" class="map"></div>
  </div>
</template>

<script setup lang="ts">
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';

type Vehicle = {
  deviceCode: string;
  gosNum: string;
  routeId: number;
  routeNumber: string;
  routeType: string;
  lat: number;
  lng: number;
  navTime: string;
};
type Stop = { id: number; name: string; lat: number; lng: number };
type MetroStation = { id: number; name: string; lat: number; lng: number };
type MetroEntrance = { id: number; station_name: string; lat: number; lng: number };
type Route = { id: number; type: string; number: string; shortName: string; name: string };
type GeometryRecord = { routeId: number; subrouteId: number; directionName: string; forward: boolean; points: { lat: number; lng: number }[] };
type RouteStopsDirection = {
  subrouteId: number;
  directionTo: string;
  forward: boolean;
  stopsCount: number;
  stations: { id: number; name: string; lat: number; lng: number }[];
};
type RouteStopsRecord = { id: number; type: string; shortName: string; directions: RouteStopsDirection[] };

const { api } = useApi();
const { fetchAllRecords } = useCollectionRecords();
const route = useRoute();

const TYPE_OPTIONS: { code: RouteTypeCode; label: string; icon: string }[] = [
  { code: 'А', label: 'Автобус', icon: ROUTE_TYPE_ICON['А'] },
  { code: 'Тм', label: 'Трамвай', icon: ROUTE_TYPE_ICON['Тм'] },
  { code: 'Тб', label: 'Троллейбус', icon: ROUTE_TYPE_ICON['Тб'] },
];

const mapEl = ref<HTMLDivElement | null>(null);
const error = ref('');
let map: MapLibreMap;
let mapReady = false;

const vehicleTypesOn = reactive(new Set<RouteTypeCode>(['А', 'Тм', 'Тб']));
const stopTypesOn = reactive(new Set<RouteTypeCode>());
const showMetroStations = ref(true);
const showMetroEntrances = ref(false);
const onlyRouteVehicles = ref(true);

const vehicles = ref<Vehicle[]>([]);
const stops = ref<Stop[]>([]);
const metroStations = ref<MetroStation[]>([]);
const metroEntrances = ref<MetroEntrance[]>([]);
const routes = ref<Route[]>([]);
const routeStops = ref<RouteStopsRecord[]>([]);
const selectedRouteId = ref<number | null>(null);
const activeDirections = reactive(new Set<number>());
const geometryLoading = ref(false);
let geometryCache: GeometryRecord[] | null = null;

let vehiclesTimer: ReturnType<typeof setInterval> | undefined;

// stop id -> set of route types serving it, and stop id -> the actual routes serving it
// (built once from route_stops, which lists every route's ordered stations per direction).
// The type map powers "show only tram stops" etc. (a stop itself carries no transport-type
// field - only routes do); the routes map powers the stop click card (route badges, like a
// real stop sign / the "frieze generator" - see design/tools/transport-stops-generator).
const stopTypeMap = new Map<number, Set<RouteTypeCode>>();
const stopRoutesMap = new Map<number, { shortName: string; type: string }[]>();
const stopCountByType = ref<Record<string, number>>({ А: 0, Тм: 0, Тб: 0 });

function buildStopTypeMap() {
  stopTypeMap.clear();
  stopRoutesMap.clear();
  for (const r of routeStops.value) {
    const code = normalizeRouteType(r.type);
    if (!code) continue;
    for (const dir of r.directions) {
      for (const st of dir.stations) {
        if (!stopTypeMap.has(st.id)) stopTypeMap.set(st.id, new Set());
        stopTypeMap.get(st.id)!.add(code);

        if (!stopRoutesMap.has(st.id)) stopRoutesMap.set(st.id, []);
        const list = stopRoutesMap.get(st.id)!;
        if (!list.some((x) => x.shortName === r.shortName)) list.push({ shortName: r.shortName, type: r.type });
      }
    }
  }
  const counts: Record<string, number> = { А: 0, Тм: 0, Тб: 0 };
  for (const types of stopTypeMap.values()) for (const t of types) counts[t]++;
  stopCountByType.value = counts;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

function buildStopPopupHtml(stopId: number, stopName: string) {
  const routesForStop = [...(stopRoutesMap.get(stopId) || [])].sort((a, b) => a.shortName.localeCompare(b.shortName, 'ru'));
  const typeCodes = TYPE_OPTIONS.map((t) => t.code).filter((code) => routesForStop.some((r) => normalizeRouteType(r.type) === code));
  const icons = typeCodes
    .map((code) => `<img src="${ROUTE_TYPE_ICON[code]}" alt="${ROUTE_TYPE_LABEL[code]}" title="${ROUTE_TYPE_LABEL[code]}" />`)
    .join('');
  const routes = routesForStop.map((r) => escapeHtml(r.shortName)).join(', ');
  return `<div class="stop-badge"><div class="stop-badge-icons">${icons || '<span class="stop-badge-dot"></span>'}</div><div class="stop-badge-body"><div class="stop-badge-name">${escapeHtml(stopName)}</div>${routes ? `<div class="stop-badge-routes">${routes}</div>` : ''}</div></div>`;
}

const vehicleCountByType = computed(() => {
  const counts: Record<string, number> = { А: 0, Тм: 0, Тб: 0 };
  for (const v of vehicles.value) {
    const code = normalizeRouteType(v.routeType);
    if (code) counts[code]++;
  }
  return counts;
});

const vehiclesAllOn = computed(() => TYPE_OPTIONS.every((t) => vehicleTypesOn.has(t.code)));
const stopsAllOn = computed(() => TYPE_OPTIONS.every((t) => stopTypesOn.has(t.code)));

const selectedRoute = computed(() => routes.value.find((r) => r.id === selectedRouteId.value) || null);
const selectedRouteDirections = computed(() => routeStops.value.find((r) => r.id === selectedRouteId.value)?.directions || []);

// A link from a transport section in the sidebar opens the map in a focused
// "stops of this transport type" mode. Keep this in a separate function and
// watch the query because switching, for example, from the bus link to the tram
// link reuses the same /map page instance instead of mounting it again.
function applyStopTypePreset(value: unknown) {
  const code = normalizeRouteType(typeof value === 'string' ? value : '');

  vehicleTypesOn.clear();
  stopTypesOn.clear();
  if (code) {
    stopTypesOn.add(code);
  } else {
    for (const type of TYPE_OPTIONS) vehicleTypesOn.add(type.code);
  }
  showMetroStations.value = !code;
  showMetroEntrances.value = false;
  selectedRouteId.value = null;
  activeDirections.clear();

  // During initial setup the sources do not exist yet; the regular initial
  // redraw will use this state after the map loads. These calls handle query
  // changes while the map is already open.
  if (mapReady) {
    redrawVehicles();
    redrawStops();
    redrawMetroStations();
    redrawMetroEntrances();
    drawRouteGeometry();
  }
}

function toggleSet<T>(set: Set<T>, value: T, after: () => void) {
  set.has(value) ? set.delete(value) : set.add(value);
  after();
}

function toggleAll(set: Set<RouteTypeCode>, after: () => void) {
  const allOn = TYPE_OPTIONS.every((t) => set.has(t.code));
  set.clear();
  if (!allOn) for (const t of TYPE_OPTIONS) set.add(t.code);
  after();
}

function setData(id: string, data: GeoJSON.FeatureCollection) {
  if (!mapReady) return;
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

function emptyFC(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function redrawVehicles() {
  const activeRoute = onlyRouteVehicles.value ? selectedRoute.value : null;
  const features: GeoJSON.Feature[] = [];
  for (const v of vehicles.value) {
    if (v.lat == null || v.lng == null) continue;
    const code = normalizeRouteType(v.routeType);
    if (!code || !vehicleTypesOn.has(code)) continue;
    if (activeRoute && v.routeId !== activeRoute.id) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      properties: {
        color: routeTypeColor(v.routeType),
        popup: `Маршрут ${v.routeNumber} (${routeTypeLabel(v.routeType)})<br>Госномер: ${v.gosNum}<br>${v.navTime}`,
      },
    });
  }
  setData('src-vehicles', { type: 'FeatureCollection', features });
}

function redrawStops() {
  if (stopTypesOn.size === 0) return setData('src-stops', emptyFC());
  const features: GeoJSON.Feature[] = [];
  for (const s of stops.value) {
    const types = stopTypeMap.get(s.id);
    if (!types) continue;
    const active = [...types].some((t) => stopTypesOn.has(t));
    if (!active) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { popup: buildStopPopupHtml(s.id, s.name) },
    });
  }
  setData('src-stops', { type: 'FeatureCollection', features });
}

function buildMetroStationPopupHtml(name: string) {
  return `<div class="stop-badge"><div class="stop-badge-icons"><img src="/design/icons/metro.svg" alt="Метро" /></div><div class="stop-badge-body"><div class="stop-badge-name">${escapeHtml(name)}</div></div></div>`;
}

function buildMetroEntrancePopupHtml(stationName: string) {
  return `<div class="stop-badge"><div class="stop-badge-icons"><img src="/design/icons/entrance.svg" alt="Вход" /></div><div class="stop-badge-body"><div class="stop-badge-name">Вход</div><div class="stop-badge-routes">${escapeHtml(stationName)}</div></div></div>`;
}

function redrawMetroStations() {
  if (!showMetroStations.value) return setData('src-metro-stations', emptyFC());
  setData('src-metro-stations', {
    type: 'FeatureCollection',
    features: metroStations.value.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { popup: buildMetroStationPopupHtml(s.name) },
    })),
  });
}

function redrawMetroEntrances() {
  if (!showMetroEntrances.value) return setData('src-metro-entrances', emptyFC());
  setData('src-metro-entrances', {
    type: 'FeatureCollection',
    features: metroEntrances.value.map((e) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: { popup: buildMetroEntrancePopupHtml(e.station_name) },
    })),
  });
}

async function loadStaticLayers() {
  try {
    [stops.value, metroStations.value, metroEntrances.value, routes.value, routeStops.value] = await Promise.all([
      fetchAllRecords<Stop>('ground_transport/stops'),
      fetchAllRecords<MetroStation>('metro/stations'),
      fetchAllRecords<MetroEntrance>('metro/entrances'),
      fetchAllRecords<Route>('ground_transport/routes'),
      fetchAllRecords<RouteStopsRecord>('ground_transport/route_stops'),
    ]);
    buildStopTypeMap();
    redrawStops();
    redrawMetroStations();
    redrawMetroEntrances();
  } catch (err: any) {
    error.value = err.message;
  }
}

async function loadVehicles() {
  try {
    const res = await api<{ vehicles: Vehicle[] }>('/api/live/vehicles');
    vehicles.value = res.vehicles;
    redrawVehicles();
  } catch {
    // proxy may be offline - just skip this tick
  }
}

// Draws the selected route's line(s) and its own stops together - toggled per direction,
// independent of the general "Остановки" layer above. Both directions use the route's own
// transport-type color (never a different type's color) - forward is solid/filled, backward
// is dashed/hollow, so direction is distinguishable without implying a different vehicle type.
function drawRouteGeometry() {
  if (selectedRouteId.value == null || !geometryCache || !selectedRoute.value) {
    setData('src-route-line', emptyFC());
    setData('src-route-stops', emptyFC());
    return;
  }

  const baseColor = routeTypeColor(selectedRoute.value.type);
  const subroutes = geometryCache.filter((g) => g.routeId === selectedRouteId.value && activeDirections.has(g.subrouteId));
  const directions = selectedRouteDirections.value;

  const lineFeatures: GeoJSON.Feature[] = [];
  const stopFeatures: GeoJSON.Feature[] = [];
  let bounds: import('maplibre-gl').LngLatBounds | null = null;

  subroutes.forEach((sr) => {
    const coords = sr.points.map((p) => [p.lng, p.lat] as [number, number]);
    lineFeatures.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { color: baseColor, forward: sr.forward, popup: `${sr.directionName} (${sr.forward ? 'прямое направление' : 'обратное направление'})` },
    });
    for (const c of coords) bounds = bounds ? bounds.extend(c) : new maplibregl.LngLatBounds(c, c);

    const dir = directions.find((d) => d.subrouteId === sr.subrouteId);
    dir?.stations.forEach((st, idx) => {
      stopFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [st.lng, st.lat] },
        properties: { color: baseColor, forward: sr.forward, popup: `${st.name}<br><span style="color:#888">№${idx + 1} из ${dir.stopsCount} · ${dir.directionTo}</span>` },
      });
    });
  });

  setData('src-route-line', { type: 'FeatureCollection', features: lineFeatures });
  setData('src-route-stops', { type: 'FeatureCollection', features: stopFeatures });
  if (bounds) map.fitBounds(bounds, { padding: 40 });
}

async function onRouteSelected() {
  activeDirections.clear();
  for (const d of selectedRouteDirections.value) activeDirections.add(d.subrouteId);

  if (selectedRouteId.value == null) {
    drawRouteGeometry();
    redrawVehicles();
    return;
  }

  if (!geometryCache) {
    geometryLoading.value = true;
    try {
      geometryCache = await fetchAllRecords<GeometryRecord>('ground_transport/route_geometry');
    } catch (err: any) {
      error.value = err.message;
      geometryLoading.value = false;
      return;
    }
    geometryLoading.value = false;
  }

  drawRouteGeometry();
  redrawVehicles();
}

watch(showMetroStations, redrawMetroStations);
watch(showMetroEntrances, redrawMetroEntrances);
watch(() => route.query.stopType, applyStopTypePreset);

let maplibregl: typeof import('maplibre-gl');

function addPointLayer(id: string, paint: import('maplibre-gl').CircleLayerSpecification['paint'], popupClass?: string) {
  map.addSource(`src-${id}`, { type: 'geojson', data: emptyFC() });
  map.addLayer({ id: `layer-${id}`, type: 'circle', source: `src-${id}`, paint });
  bindPopup(`layer-${id}`, popupClass);
}

function bindPopup(layerId: string, popupClass?: string) {
  map.on('click', layerId, (e) => {
    const f = e.features?.[0];
    if (!f) return;
    new maplibregl.Popup(popupClass ? { className: popupClass } : undefined)
      .setLngLat(e.lngLat)
      .setHTML(String(f.properties?.popup || ''))
      .addTo(map);
  });
  map.on('mouseenter', layerId, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', layerId, () => (map.getCanvas().style.cursor = ''));
}

onMounted(async () => {
  // Deep link from a transport-type section in the sidebar, e.g. /map?stopType=Тм
  applyStopTypePreset(route.query.stopType);

  maplibregl = await loadMapLibre();
  if (!mapEl.value) return;

  map = new maplibregl.Map({
    container: mapEl.value,
    style: MAP_STYLE,
    center: CITY_CENTER,
    zoom: 12,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  map.addControl(new maplibregl.AttributionControl({ compact: true }));

  await new Promise<void>((resolve) => map.on('load', () => resolve()));

  addPointLayer(
    'stops',
    { 'circle-radius': 3, 'circle-color': '#999', 'circle-stroke-color': '#666', 'circle-stroke-width': 1 },
    'stop-popup',
  );
  addPointLayer(
    'metro-stations',
    { 'circle-radius': 7, 'circle-color': '#c62828', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
    'stop-popup',
  );
  addPointLayer(
    'metro-entrances',
    { 'circle-radius': 4, 'circle-color': '#e67e22', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 },
    'stop-popup',
  );

  map.addSource('src-route-line', { type: 'geojson', data: emptyFC() });
  map.addLayer({
    id: 'layer-route-line-fwd',
    type: 'line',
    source: 'src-route-line',
    filter: ['==', ['get', 'forward'], true],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 4 },
  });
  map.addLayer({
    id: 'layer-route-line-bwd',
    type: 'line',
    source: 'src-route-line',
    filter: ['==', ['get', 'forward'], false],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.65, 'line-dasharray': [1, 2] },
  });
  bindPopup('layer-route-line-fwd');
  bindPopup('layer-route-line-bwd');

  map.addSource('src-route-stops', { type: 'geojson', data: emptyFC() });
  map.addLayer({
    id: 'layer-route-stops-fwd',
    type: 'circle',
    source: 'src-route-stops',
    filter: ['==', ['get', 'forward'], true],
    paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
  });
  map.addLayer({
    id: 'layer-route-stops-bwd',
    type: 'circle',
    source: 'src-route-stops',
    filter: ['==', ['get', 'forward'], false],
    paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2 },
  });
  bindPopup('layer-route-stops-fwd');
  bindPopup('layer-route-stops-bwd');

  addPointLayer('vehicles', { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 });
  mapReady = true;

  await loadStaticLayers();
  await loadVehicles();
  vehiclesTimer = setInterval(loadVehicles, 5000);
});

onUnmounted(() => {
  clearInterval(vehiclesTimer);
  mapReady = false;
  map?.remove();
});
</script>

<style scoped>
.page {
  display: flex;
  gap: 16px;
  height: 100%;
}
h1 {
  margin: 0 0 16px;
}
.panel {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.panel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 4px;
}
.section-icon {
  width: 13px;
  height: 13px;
  object-fit: contain;
  opacity: 0.85;
}
.section-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  margin: 8px 0 2px;
}
.v-chip {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.v-chip input {
  width: auto;
  accent-color: var(--ekb-accent-contrast);
}
.v-chip .count {
  margin-left: auto;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}
.v-chip.active {
  background: var(--text-primary);
  border-color: var(--text-primary);
  color: #fff;
}
.v-chip.active .count {
  color: #cfd3da;
}
.v-chip.active :deep(svg) {
  color: #fff;
}
.v-chip-icon {
  width: 19px;
  height: 19px;
  object-fit: contain;
}
.all-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}
.hint {
  font-size: 12px;
  color: var(--text-tertiary);
}
.route-info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface-muted);
  border-radius: var(--radius-md);
  font-size: 13px;
  margin: 4px 0;
}
.route-info img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
  margin-top: 1px;
}
.route-info .muted {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 2px;
}
.map {
  flex: 1;
  min-height: 520px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.map :deep(.stop-popup .maplibregl-popup-content) {
  padding: 0;
  overflow: hidden;
  border-radius: 8px;
  background: #101102;
  color: #f7f8f9;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
}
.map :deep(.stop-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip),
.map :deep(.stop-popup.maplibregl-popup-anchor-top-left .maplibregl-popup-tip),
.map :deep(.stop-popup.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) {
  border-bottom-color: #101102;
}
.map :deep(.stop-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip),
.map :deep(.stop-popup.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip),
.map :deep(.stop-popup.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) {
  border-top-color: #101102;
}
.map :deep(.stop-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
  border-right-color: #101102;
}
.map :deep(.stop-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
  border-left-color: #101102;
}
.map :deep(.stop-popup .maplibregl-popup-close-button) {
  z-index: 1;
  width: 22px;
  height: 22px;
  padding: 0;
  color: rgba(247, 248, 249, 0.65);
  font-size: 18px;
  line-height: 20px;
}
.map :deep(.stop-badge) {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: 'Iset Sans', system-ui, -apple-system, sans-serif;
  min-width: 180px;
  max-width: 280px;
  padding: 9px 26px 9px 10px;
}
.map :deep(.stop-badge-icons) {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 2px;
}
.map :deep(.stop-badge-icons img) {
  display: block;
  width: auto;
  height: 32px;
  max-width: 24px;
  object-fit: contain;
}
.map :deep(.stop-badge-dot) {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #f7f8f9;
  opacity: 0.8;
}
.map :deep(.stop-badge-body) {
  min-width: 0;
}
.map :deep(.stop-badge-name) {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.12;
  overflow-wrap: anywhere;
}
.map :deep(.stop-badge-routes) {
  margin-top: 3px;
  color: rgba(247, 248, 249, 0.62);
  font-size: 11px;
  line-height: 1.2;
  white-space: normal;
}
</style>
