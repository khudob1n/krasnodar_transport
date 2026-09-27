<template>
  <div ref="el" class="minimap"></div>
</template>

<script setup lang="ts">
const props = defineProps<{ points: { lat: number; lng: number }[] }>();

const el = ref<HTMLDivElement | null>(null);
let map: import('maplibre-gl').Map | null = null;

onMounted(async () => {
  if (!el.value) return;
  const maplibregl = await loadMapLibre();
  map = new maplibregl.Map({
    container: el.value,
    style: MAP_STYLE,
    center: CITY_CENTER,
    zoom: 12,
    scrollZoom: false,
    attributionControl: false,
  });

  map.on('load', () => {
    if (!map || props.points.length < 2) return;
    const coords = props.points.map((p) => [p.lng, p.lat] as [number, number]);

    map.addSource('preview-line', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
    map.addLayer({
      id: 'preview-line',
      type: 'line',
      source: 'preview-line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#e6bf00', 'line-width': 4 },
    });

    const bounds = coords.reduce((b, c) => b.extend(c as [number, number]), new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(bounds, { padding: 16, animate: false });
  });
});

onUnmounted(() => {
  map?.remove();
});
</script>

<style scoped>
.minimap {
  height: 260px;
  border-radius: 8px;
  border: 1px solid #e2e4e8;
  overflow: hidden;
}
</style>
