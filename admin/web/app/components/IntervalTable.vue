<template>
  <div class="wrap">
    <div class="table">
      <div class="table-head">
        <span>С</span>
        <span>До</span>
        <span>Интервал, мин (от)</span>
        <span>Интервал, мин (до)</span>
        <span></span>
      </div>
      <div v-for="(row, i) in rows" :key="row.uid" class="table-row">
        <input v-model="row.from" type="text" placeholder="06:00" :class="{ invalid: !isValidTime(row.from) }" :disabled="disabled" @input="onChange" />
        <input v-model="row.to" type="text" placeholder="07:00" :class="{ invalid: !isValidTime(row.to) }" :disabled="disabled" @input="onChange" />
        <input
          v-model.number="row.minutesFrom"
          type="number"
          min="0"
          step="0.5"
          :class="{ invalid: !isValidMinutes(row.minutesFrom) }"
          :disabled="disabled"
          @input="onChange"
        />
        <input
          v-model.number="row.minutesTo"
          type="number"
          min="0"
          step="0.5"
          :class="{ invalid: !isValidMinutes(row.minutesTo, row.minutesFrom) }"
          :disabled="disabled"
          @input="onChange"
        />
        <div class="row-actions">
          <button type="button" class="ghost icon-btn" :disabled="disabled || i === 0" title="Выше" @click="move(i, -1)">
            <AppIcon name="chevron-down" :size="14" style="transform: rotate(180deg)" />
          </button>
          <button type="button" class="ghost icon-btn" :disabled="disabled || i === rows.length - 1" title="Ниже" @click="move(i, 1)">
            <AppIcon name="chevron-down" :size="14" />
          </button>
          <button type="button" class="ghost icon-btn danger" :disabled="disabled" title="Удалить" @click="remove(i)">
            <AppIcon name="trash" :size="14" />
          </button>
        </div>
      </div>
    </div>
    <p class="hint">
      Для фиксированного интервала укажите одно и то же значение в «от» и «до» (например 8 и 8). Для интервала
      с разбросом (например «4–5 мин.») — 4 и 5. Доли минуты — через 0.5 (7.5 = 7 мин 30 сек).
    </p>
    <button v-if="!disabled" type="button" class="ghost add-btn" @click="add">
      <AppIcon name="plus" :size="14" /> Добавить интервал
    </button>
  </div>
</template>

<script setup lang="ts">
type Interval = { from: string; to: string; interval_seconds_min: number; interval_seconds_max: number };
type Row = { uid: number; from: string; to: string; minutesFrom: number; minutesTo: number };

const props = defineProps<{ disabled: boolean }>();
const emit = defineEmits<{ (e: 'update'): void }>();
const model = defineModel<Interval[]>({ required: true });

let uidSeq = 0;
const rows = ref<Row[]>(
  model.value.map((i) => ({
    uid: uidSeq++,
    from: i.from,
    to: i.to,
    minutesFrom: i.interval_seconds_min / 60,
    minutesTo: i.interval_seconds_max / 60,
  })),
);

function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value.trim());
}

function isValidMinutes(value: number, min?: number) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return false;
  if (min != null && value < min) return false;
  return true;
}

function sync() {
  model.value = rows.value.map((r) => ({
    from: r.from,
    to: r.to,
    interval_seconds_min: Math.round(r.minutesFrom * 60),
    interval_seconds_max: Math.round(r.minutesTo * 60),
  }));
}

function onChange() {
  sync();
  emit('update');
}

function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= rows.value.length) return;
  [rows.value[index], rows.value[target]] = [rows.value[target], rows.value[index]];
  onChange();
}

function add() {
  rows.value.push({ uid: uidSeq++, from: '', to: '', minutesFrom: 0, minutesTo: 0 });
  sync();
}

function remove(index: number) {
  rows.value.splice(index, 1);
  onChange();
}
</script>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.table {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.table-head {
  display: grid;
  grid-template-columns: 80px 80px 1fr 1fr 100px;
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
  grid-template-columns: 80px 80px 1fr 1fr 100px;
  gap: 10px;
  align-items: center;
}
input.invalid {
  border-color: var(--ekb-danger);
}
.hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}
.row-actions {
  display: flex;
  gap: 2px;
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
