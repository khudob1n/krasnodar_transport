<template>
  <div class="direction">
    <p class="hint">
      Конечная — {{ stations[stations.length - 1]?.name || '…' }}, {{ stations.length }}
      {{ pluralizeRu(stations.length, 'остановка', 'остановки', 'остановок') }}.
    </p>

    <div class="stops">
      <div v-for="(s, i) in stations" :key="s.uid" class="stop-row">
        <span class="stop-index">{{ i + 1 }}</span>
        <StopSearchPicker :stops="stopOptions" :model-value="s.stopId" :disabled="disabled" @select="(stop) => onStopPicked(s, stop)" />
        <div class="stop-actions">
          <button type="button" class="ghost icon-btn" :disabled="disabled || i === 0" title="Выше" @click="move(i, -1)">
            <AppIcon name="chevron-down" :size="14" style="transform: rotate(180deg)" />
          </button>
          <button type="button" class="ghost icon-btn" :disabled="disabled || i === stations.length - 1" title="Ниже" @click="move(i, 1)">
            <AppIcon name="chevron-down" :size="14" />
          </button>
          <button type="button" class="ghost icon-btn danger" :disabled="disabled || stations.length <= 2" title="Удалить" @click="removeStop(i)">
            <AppIcon name="trash" :size="14" />
          </button>
        </div>
      </div>
    </div>

    <button v-if="!disabled" type="button" class="ghost add-btn" @click="addStop">
      <AppIcon name="plus" :size="14" /> Добавить остановку
    </button>

    <p v-if="!isValid" class="error">Выберите остановку в каждой строке (минимум 2) — иначе это направление не сохранится.</p>
  </div>
</template>

<script setup lang="ts">
type StationEntry = { id: number; name: string; lat: number; lng: number };
type Direction = { subrouteId: number; directionTo: string; forward: boolean; stopsCount: number; stations: StationEntry[] };
type Stop = { id: number; name: string; lat: number; lng: number };
type StopRow = { uid: number; stopId: number | null; name: string; lat: number | null; lng: number | null };

const props = defineProps<{ disabled: boolean; stopOptions: Stop[] }>();
const emit = defineEmits<{ (e: 'update'): void; (e: 'update:valid', valid: boolean): void }>();
const model = defineModel<Direction>({ required: true });

let uidSeq = 0;
const stations = ref<StopRow[]>(
  model.value.stations.map((s) => ({ uid: uidSeq++, stopId: s.id, name: s.name, lat: s.lat, lng: s.lng })),
);

const isValid = computed(() => stations.value.length >= 2 && stations.value.every((s) => s.stopId != null));
watch(isValid, (v) => emit('update:valid', v), { immediate: true });

function onStopPicked(row: StopRow, stop: Stop) {
  row.stopId = stop.id;
  row.name = stop.name;
  row.lat = stop.lat;
  row.lng = stop.lng;
  sync();
}

function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= stations.value.length) return;
  [stations.value[index], stations.value[target]] = [stations.value[target], stations.value[index]];
  sync();
}

function addStop() {
  stations.value.push({ uid: uidSeq++, stopId: null, name: '', lat: null, lng: null });
}

function removeStop(index: number) {
  stations.value.splice(index, 1);
  sync();
}

function sync() {
  if (!isValid.value) return;
  const entries: StationEntry[] = stations.value.map((s) => ({ id: s.stopId as number, name: s.name, lat: s.lat as number, lng: s.lng as number }));
  model.value = {
    subrouteId: model.value.subrouteId,
    forward: model.value.forward,
    directionTo: entries[entries.length - 1]?.name ?? model.value.directionTo,
    stopsCount: entries.length,
    stations: entries,
  };
  emit('update');
}
</script>

<style scoped>
.direction {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-tertiary);
}
.stops {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stop-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stop-index {
  flex-shrink: 0;
  width: 22px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}
.stop-row .picker {
  flex: 1;
}
.stop-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.icon-btn {
  padding: 6px;
  color: var(--text-secondary);
}
.icon-btn:disabled {
  opacity: 0.35;
}
.icon-btn.danger:hover:not(:disabled) {
  color: var(--ekb-danger);
}
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
}
</style>
