<template>
  <div class="editor">
    <section class="block">
      <h2><AppIcon name="clock" :size="15" /> Часы работы</h2>
      <div class="row">
        <label class="field time-field">
          <span>Открытие</span>
          <input v-model="openTime" type="text" placeholder="06:00" :class="{ invalid: !isValidTime(openTime) }" :disabled="disabled" @input="emitUpdate" />
        </label>
        <label class="field time-field">
          <span>Закрытие</span>
          <input v-model="closeTime" type="text" placeholder="24:00" :class="{ invalid: !isValidTime(closeTime) }" :disabled="disabled" @input="emitUpdate" />
        </label>
        <label class="field">
          <span>Уточнение</span>
          <input v-model="hoursNote" type="text" placeholder="ежедневно" :disabled="disabled" @input="emitUpdate" />
        </label>
      </div>
    </section>

    <section class="block">
      <h2><AppIcon name="clock" :size="15" /> Время последнего поезда</h2>
      <p class="hint">По конечным станциям — отдельно для буднего и выходного дня.</p>
      <div class="table">
        <div class="table-head">
          <span>Станция</span>
          <span>Будни</span>
          <span>Выходные</span>
          <span></span>
        </div>
        <div v-for="row in lastTrain" :key="row.uid" class="table-row">
          <select v-model.number="row.stationId" :disabled="disabled" @change="onStationPicked(row)">
            <option :value="null" disabled>Выберите станцию…</option>
            <option v-for="opt in stationOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
          </select>
          <input v-model="row.weekday" type="text" placeholder="00:02" :class="{ invalid: !isValidTime(row.weekday) }" :disabled="disabled" @input="emitUpdate" />
          <input v-model="row.weekend" type="text" placeholder="00:02" :class="{ invalid: !isValidTime(row.weekend) }" :disabled="disabled" @input="emitUpdate" />
          <button type="button" class="ghost icon-btn danger" :disabled="disabled" title="Удалить" @click="removeLastTrain(row.uid)">
            <AppIcon name="trash" :size="14" />
          </button>
        </div>
      </div>
      <button v-if="!disabled" type="button" class="ghost add-btn" @click="addLastTrain">
        <AppIcon name="plus" :size="14" /> Добавить станцию
      </button>
    </section>

    <section class="block">
      <h2><AppIcon name="clock" :size="15" /> Интервалы движения — будни</h2>
      <IntervalTable v-model="weekdayIntervals" :disabled="disabled" @update="emitUpdate" />
    </section>

    <section class="block">
      <h2><AppIcon name="clock" :size="15" /> Интервалы движения — выходные</h2>
      <IntervalTable v-model="weekendIntervals" :disabled="disabled" @update="emitUpdate" />
    </section>

    <section class="block">
      <h2><AppIcon name="alert" :size="15" /> Источник данных</h2>
      <input v-model="source" type="text" :disabled="disabled" @input="emitUpdate" />
      <a v-if="source" :href="source" target="_blank" rel="noopener" class="source-link">Открыть источник ↗</a>
    </section>

    <p v-if="!isValid" class="error">Проверьте поля времени (формат ЧЧ:ММ, до 24:00) и выберите станцию в каждой строке — иначе изменения не сохранятся.</p>
  </div>
</template>

<script setup lang="ts">
type Interval = { from: string; to: string; interval_seconds_min: number; interval_seconds_max: number };
type ScheduleData = {
  operating_hours: string;
  last_train: Record<string, { будни: string; выходные: string }>;
  intervals_weekday_min: Interval[];
  intervals_weekend_min: Interval[];
  source: string;
};
type StationOption = { id: number; name: string };
type LastTrainRow = { uid: number; stationId: number | null; stationName: string; weekday: string; weekend: string };

const props = defineProps<{ modelValue: ScheduleData; disabled: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: ScheduleData): void; (e: 'update:valid', valid: boolean): void }>();

const { fetchAllRecords } = useCollectionRecords();

function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value.trim());
}

// "06:00–24:00 ежедневно" -> open/close times + a free-text tail, so the admin edits plain
// HH:MM fields instead of one opaque string. Falls back to raw text in "hoursNote" if the
// source string doesn't match that shape (kept editable either way).
const hoursMatch = props.modelValue.operating_hours.match(/^(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})\s*(.*)$/);
const openTime = ref(hoursMatch?.[1] ?? '');
const closeTime = ref(hoursMatch?.[2] ?? '');
const hoursNote = ref(hoursMatch?.[3] ?? props.modelValue.operating_hours);

let uidSeq = 0;
const lastTrain = ref<LastTrainRow[]>(
  Object.entries(props.modelValue.last_train).map(([station, times]) => ({
    uid: uidSeq++,
    stationId: null,
    stationName: station,
    weekday: times.будни,
    weekend: times.выходные,
  })),
);
const weekdayIntervals = ref<Interval[]>(props.modelValue.intervals_weekday_min.map((i) => ({ ...i })));
const weekendIntervals = ref<Interval[]>(props.modelValue.intervals_weekend_min.map((i) => ({ ...i })));
const source = ref(props.modelValue.source ?? '');
const stationOptions = ref<StationOption[]>([]);

function onStationPicked(row: LastTrainRow) {
  const opt = stationOptions.value.find((o) => o.id === row.stationId);
  row.stationName = opt?.name ?? row.stationName;
  emitUpdate();
}

function addLastTrain() {
  lastTrain.value.push({ uid: uidSeq++, stationId: null, stationName: '', weekday: '', weekend: '' });
}

function removeLastTrain(uid: number) {
  lastTrain.value = lastTrain.value.filter((r) => r.uid !== uid);
  emitUpdate();
}

const isValid = computed(() => {
  if (!isValidTime(openTime.value) || !isValidTime(closeTime.value)) return false;
  for (const row of lastTrain.value) {
    if (row.stationId == null && !row.stationName) return false;
    if (!isValidTime(row.weekday) || !isValidTime(row.weekend)) return false;
  }
  for (const list of [weekdayIntervals.value, weekendIntervals.value]) {
    for (const i of list) {
      if (!isValidTime(i.from) || !isValidTime(i.to)) return false;
      if (!Number.isFinite(i.interval_seconds_min) || !Number.isFinite(i.interval_seconds_max)) return false;
      if (i.interval_seconds_min < 0 || i.interval_seconds_max < i.interval_seconds_min) return false;
    }
  }
  return true;
});
watch(isValid, (v) => emit('update:valid', v), { immediate: true });

function emitUpdate() {
  if (!isValid.value) return;
  const lastTrainObj: ScheduleData['last_train'] = {};
  for (const row of lastTrain.value) {
    lastTrainObj[row.stationName] = { будни: row.weekday, выходные: row.weekend };
  }
  emit('update:modelValue', {
    operating_hours: `${openTime.value}–${closeTime.value}${hoursNote.value ? ' ' + hoursNote.value : ''}`,
    last_train: lastTrainObj,
    intervals_weekday_min: weekdayIntervals.value.map((i) => ({ ...i })),
    intervals_weekend_min: weekendIntervals.value.map((i) => ({ ...i })),
    source: source.value,
  });
}

onMounted(async () => {
  try {
    const list = await fetchAllRecords<StationOption>('metro/stations');
    stationOptions.value = [...list].sort((a, b) => a.name.localeCompare(b, 'ru'));
    for (const row of lastTrain.value) {
      const match = stationOptions.value.find((o) => o.name === row.stationName);
      if (match) row.stationId = match.id;
    }
  } catch {
    // the picker just stays empty if stations can't be loaded - existing rows keep their name
  }
});
</script>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.block h2 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 10px;
  font-size: 14.5px;
}
.hint {
  margin: -4px 0 10px;
  font-size: 12.5px;
  color: var(--text-tertiary);
}
.row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.row .field {
  flex: 1 1 140px;
}
.time-field {
  flex: 0 1 110px;
}
input.invalid {
  border-color: var(--ekb-danger);
}
.table {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.table-head {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 32px;
  gap: 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-tertiary);
  padding: 0 2px;
}
.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 32px;
  gap: 10px;
  align-items: center;
}
.source-link {
  display: inline-block;
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--text-secondary);
}
.icon-btn {
  padding: 6px;
  color: var(--text-secondary);
  justify-self: start;
}
.icon-btn.danger:hover:not(:disabled) {
  color: var(--ekb-danger);
}
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  margin-top: 8px;
}
</style>
