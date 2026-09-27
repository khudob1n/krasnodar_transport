<template>
  <div class="editor">
    <div class="row">
      <label class="field">
        <span>Номер линии</span>
        <input v-model="lineNumber" type="text" :disabled="disabled" @input="emitUpdate" />
      </label>
      <label class="field">
        <span>Название линии</span>
        <input v-model="lineName" type="text" :disabled="disabled" @input="emitUpdate" />
      </label>
      <label class="field color-field">
        <span>Цвет на карте</span>
        <span class="color-input">
          <input v-model="lineColor" type="color" :disabled="disabled" @input="emitUpdate" />
          <input v-model="lineColor" type="text" class="color-hex" :disabled="disabled" @input="emitUpdate" />
        </span>
      </label>
    </div>

    <div class="stations-head">
      <h2>Станции по порядку</h2>
      <p class="hint">
        Второе направление (в обратную сторону) собирается автоматически — этот список задаёт порядок только
        в одну сторону, от {{ stations[0]?.stationName || '…' }} до {{ stations[stations.length - 1]?.stationName || '…' }}.
      </p>
    </div>

    <div class="stations">
      <div v-for="(s, i) in stations" :key="s.uid" class="station-row">
        <span class="station-index">{{ i + 1 }}</span>
        <select v-model.number="s.stationId" :disabled="disabled" @change="onStationPicked(s)">
          <option :value="null" disabled>Выберите станцию…</option>
          <option v-for="opt in stationOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
        </select>
        <div class="station-actions">
          <button type="button" class="ghost icon-btn" :disabled="disabled || i === 0" title="Выше" @click="move(i, -1)">
            <AppIcon name="chevron-down" :size="14" style="transform: rotate(180deg)" />
          </button>
          <button type="button" class="ghost icon-btn" :disabled="disabled || i === stations.length - 1" title="Ниже" @click="move(i, 1)">
            <AppIcon name="chevron-down" :size="14" />
          </button>
          <button type="button" class="ghost icon-btn danger" :disabled="disabled || stations.length <= 2" title="Удалить" @click="removeStation(i)">
            <AppIcon name="trash" :size="14" />
          </button>
        </div>
      </div>
    </div>

    <button v-if="!disabled" type="button" class="ghost add-btn" @click="addStation">
      <AppIcon name="plus" :size="14" /> Добавить станцию
    </button>

    <p v-if="hasIncompleteStation" class="error">Выберите станцию в каждой строке — иначе изменения не сохранятся.</p>
  </div>
</template>

<script setup lang="ts">
type StationEntry = { line_id: number; order: number; station_id: number; station_name: string };
type Direction = { direction_id: number; terminus_station: string; stations: StationEntry[] };
type LineData = {
  line: { id: number; number: string; name: string; color: string };
  directions: Direction[];
};
type StationOption = { id: number; name: string };
type StationRow = { uid: number; stationId: number | null; stationName: string };

const props = defineProps<{ modelValue: LineData; disabled: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: LineData): void; (e: 'update:valid', valid: boolean): void }>();

const { fetchAllRecords } = useCollectionRecords();

const lineNumber = ref(props.modelValue.line.number ?? '');
const lineName = ref(props.modelValue.line.name ?? '');
const lineColor = ref(props.modelValue.line.color ?? '#1c8c3a');
const stationOptions = ref<StationOption[]>([]);
let uidSeq = 0;

// The source data stores both directions (forward + the same stations reversed) - editing
// one authoritative order is enough, the reverse direction is reconstructed on save.
const stations = ref<StationRow[]>(
  (props.modelValue.directions[0]?.stations ?? []).map((s) => ({ uid: uidSeq++, stationId: s.station_id, stationName: s.station_name })),
);

const hasIncompleteStation = computed(() => stations.value.some((s) => s.stationId == null));
watch(hasIncompleteStation, (incomplete) => emit('update:valid', !incomplete), { immediate: true });

function onStationPicked(row: StationRow) {
  const opt = stationOptions.value.find((o) => o.id === row.stationId);
  row.stationName = opt?.name ?? '';
  emitUpdate();
}

function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= stations.value.length) return;
  const list = stations.value;
  [list[index], list[target]] = [list[target], list[index]];
  emitUpdate();
}

function addStation() {
  stations.value.push({ uid: uidSeq++, stationId: null, stationName: '' });
}

function removeStation(index: number) {
  stations.value.splice(index, 1);
  emitUpdate();
}

function emitUpdate() {
  if (hasIncompleteStation.value) return;
  const lineId = props.modelValue.line.id;
  const forward: StationEntry[] = stations.value.map((s, i) => ({
    line_id: lineId,
    order: i + 1,
    station_id: s.stationId as number,
    station_name: s.stationName,
  }));
  const backward: StationEntry[] = [...forward].reverse().map((s, i) => ({ ...s, order: i + 1 }));
  emit('update:modelValue', {
    line: { id: lineId, number: lineNumber.value, name: lineName.value, color: lineColor.value },
    directions: [
      { direction_id: 1, terminus_station: forward[forward.length - 1]?.station_name ?? '', stations: forward },
      { direction_id: 2, terminus_station: backward[backward.length - 1]?.station_name ?? '', stations: backward },
    ],
  });
}

onMounted(async () => {
  try {
    const list = await fetchAllRecords<StationOption>('metro/stations');
    stationOptions.value = [...list].sort((a, b) => a.name.localeCompare(b, 'ru'));
  } catch {
    // the picker just stays empty if stations can't be loaded - existing rows keep their value
  }
});
</script>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.row .field {
  flex: 1 1 160px;
}
.color-field {
  flex: 0 0 auto;
}
.color-input {
  display: flex;
  gap: 8px;
}
.color-input input[type='color'] {
  width: 40px;
  padding: 2px;
  flex-shrink: 0;
}
.color-hex {
  width: 110px;
  font-family: ui-monospace, monospace;
}
.stations-head h2 {
  margin: 0 0 4px;
  font-size: 15px;
}
.hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-tertiary);
}
.stations {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.station-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.station-index {
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}
.station-row select {
  flex: 1;
}
.station-actions {
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
