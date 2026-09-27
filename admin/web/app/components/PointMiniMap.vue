<template>
  <div ref="el" class="minimap"></div>
</template>

<script setup lang="ts">
const props = defineProps<{ lat: number | null; lng: number | null; editable: boolean }>();
const emit = defineEmits<{ (e: 'update', point: { lat: number; lng: number }): void }>();

const el = ref<HTMLDivElement | null>(null);
let map: import('maplibre-gl').Map | null = null;
let marker: import('maplibre-gl').Marker | null = null;

function makeDot() {
  const dot = document.createElement('div');
  dot.style.cssText =
    'width:14px;height:14px;border-radius:50%;background:#ffd400;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3);cursor:' +
    (props.editable ? 'grab' : 'default');
  return dot;
}

onMounted(async () => {
  if (!el.value) return;
  const maplibregl = await loadMapLibre();

  const hasPoint = props.lat != null && props.lng != null;
  const start: [number, number] = hasPoint ? [props.lng as number, props.lat as number] : CITY_CENTER;

  map = new maplibregl.Map({
    container: el.value,
    style: MAP_STYLE,
    center: start,
    zoom: hasPoint ? 16 : 11,
    scrollZoom: false,
    attributionControl: false,
  });

  marker = new maplibregl.Marker({ element: makeDot(), draggable: props.editable }).setLngLat(start).addTo(map);
  marker.on('dragend', () => {
    const pos = marker!.getLngLat();
    emit('update', { lat: Number(pos.lat.toFixed(6)), lng: Number(pos.lng.toFixed(6)) });
  });
});

watch(
  () => [props.lat, props.lng],
  ([lat, lng]) => {
    if (!map || !marker || lat == null || lng == null) return;
    const current = marker.getLngLat();
    if (Math.abs(current.lat - lat) > 1e-9 || Math.abs(current.lng - lng) > 1e-9) {
      marker.setLngLat([lng, lat]);
    }
  },
);

onUnmounted(() => {
  map?.remove();
});
</script>

<style scoped>
.minimap {
  height: 220px;
  border-radius: 8px;
  border: 1px solid #e2e4e8;
  overflow: hidden;
}
</style>
