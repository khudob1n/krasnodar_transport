<template>
  <div ref="root" class="picker">
    <input
      v-model="query"
      type="text"
      class="picker-input"
      :placeholder="disabled ? '' : 'Найти остановку по названию…'"
      :disabled="disabled"
      @focus="onFocus"
      @input="open = true"
    />
    <div v-if="open && !disabled" class="results">
      <button v-for="s in filtered.slice(0, 40)" :key="s.id" type="button" class="result-row" @click="select(s)">
        <span class="rname">{{ s.name }}</span>
      </button>
      <div v-if="filtered.length === 0" class="no-results">Ничего не найдено</div>
      <div v-else-if="filtered.length > 40" class="no-results">И ещё {{ filtered.length - 40 }} — уточните запрос</div>
    </div>
  </div>
</template>

<script setup lang="ts">
type Stop = { id: number; name: string; lat: number; lng: number };

const props = defineProps<{ stops: Stop[]; modelValue: number | null; disabled: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: number | null): void; (e: 'select', stop: Stop): void }>();

const root = ref<HTMLDivElement | null>(null);
const open = ref(false);

const selected = computed(() => props.stops.find((s) => s.id === props.modelValue) || null);
const query = ref(selected.value?.name ?? '');

// `stops` (the full ground_transport/stops list) loads asynchronously after this component is
// created, so `selected` only resolves once that arrives - keep the display text in sync with
// it (and with modelValue changing) as long as the admin isn't actively typing/picking.
watch([selected, () => props.modelValue], () => {
  if (!open.value) query.value = selected.value?.name ?? '';
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.stops;
  return props.stops.filter((s) => s.name.toLowerCase().includes(q));
});

function onFocus() {
  if (props.disabled) return;
  open.value = true;
  query.value = '';
}

function select(stop: Stop) {
  emit('update:modelValue', stop.id);
  emit('select', stop);
  query.value = stop.name;
  open.value = false;
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) {
    open.value = false;
    query.value = selected.value?.name ?? '';
  }
}
onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));
</script>

<style scoped>
.picker {
  position: relative;
}
.picker-input {
  width: 100%;
}
.results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  max-height: 260px;
  overflow-y: auto;
  z-index: 1000;
  padding: 4px;
}
.result-row {
  all: unset;
  box-sizing: border-box;
  display: block;
  width: 100%;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
}
.result-row:hover {
  background: var(--surface-muted);
}
.no-results {
  padding: 10px 8px;
  font-size: 12.5px;
  color: var(--text-tertiary);
}
</style>
