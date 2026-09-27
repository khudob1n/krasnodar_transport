<template>
  <div ref="root" class="picker">
    <div v-if="selected" class="selected-chip">
      <img :src="routeTypeIcon(selected.type) ?? ''" alt="" />
      <span><strong>{{ selected.shortName }}</strong> {{ selected.name }}</span>
      <button type="button" class="clear-btn" title="Сбросить" @click="clear">
        <AppIcon name="close" :size="13" />
      </button>
    </div>

    <template v-else>
      <div class="search-row">
        <AppIcon name="search" :size="16" class="search-icon" />
        <input
          v-model="query"
          type="search"
          placeholder="Найти маршрут по номеру или названию…"
          @focus="open = true"
        />
      </div>

      <div class="type-row">
        <label v-for="t in TYPE_OPTIONS" :key="t.code" class="pill-toggle sm" :class="{ active: activeTypes.has(t.code) }">
          <input type="checkbox" :checked="activeTypes.has(t.code)" @change="toggleType(t.code)" />
          <img :src="t.icon" class="pill-icon" alt="" />
          {{ t.label }}
        </label>
      </div>

      <div v-if="open" class="results">
        <button v-for="r in filtered.slice(0, 40)" :key="r.id" type="button" class="result-row" @click="select(r)">
          <img :src="routeTypeIcon(r.type) ?? ''" alt="" />
          <span class="rnum">{{ r.shortName }}</span>
          <span class="rname">{{ r.name }}</span>
        </button>
        <div v-if="filtered.length === 0" class="no-results">Ничего не найдено</div>
        <div v-else-if="filtered.length > 40" class="no-results">И ещё {{ filtered.length - 40 }} — уточните запрос</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
type Route = { id: number; type: string; number: string; shortName: string; name: string };

const props = defineProps<{ routes: Route[]; modelValue: number | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: number | null): void }>();

const TYPE_OPTIONS: { code: RouteTypeCode; label: string; icon: string }[] = [
  { code: 'А', label: 'Автобус', icon: ROUTE_TYPE_ICON['А'] },
  { code: 'Тм', label: 'Трамвай', icon: ROUTE_TYPE_ICON['Тм'] },
  { code: 'Тб', label: 'Троллейбус', icon: ROUTE_TYPE_ICON['Тб'] },
];

const root = ref<HTMLDivElement | null>(null);
const query = ref('');
const open = ref(false);
const activeTypes = ref(new Set<RouteTypeCode>());

const selected = computed(() => props.routes.find((r) => r.id === props.modelValue) || null);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.routes.filter((r) => {
    if (activeTypes.value.size > 0) {
      const code = normalizeRouteType(r.type);
      if (!code || !activeTypes.value.has(code)) return false;
    }
    if (!q) return true;
    return (
      r.number?.toLowerCase().includes(q) ||
      r.shortName?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q)
    );
  });
});

function toggleType(code: RouteTypeCode) {
  activeTypes.value.has(code) ? activeTypes.value.delete(code) : activeTypes.value.add(code);
  // reassign so the computed/template pick up the mutation
  activeTypes.value = new Set(activeTypes.value);
}

function select(r: Route) {
  emit('update:modelValue', r.id);
  open.value = false;
  query.value = '';
}

function clear() {
  emit('update:modelValue', null);
  query.value = '';
  open.value = false;
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));
</script>

<style scoped>
.picker {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 420px;
}
.search-row {
  position: relative;
}
.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
}
.search-row input {
  padding-left: 34px;
}
.type-row {
  display: flex;
  gap: 6px;
}
.pill-toggle.sm {
  padding: 4px 9px;
  font-size: 12px;
}
.pill-icon {
  width: 17px;
  height: 17px;
  object-fit: contain;
}
.results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 42px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  max-height: 320px;
  overflow-y: auto;
  z-index: 1000;
  padding: 4px;
}
.result-row {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
}
.result-row:hover {
  background: var(--surface-muted);
}
.result-row img {
  width: 15px;
  height: 15px;
  object-fit: contain;
  flex-shrink: 0;
}
.rnum {
  font-weight: 600;
  flex-shrink: 0;
}
.rname {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.no-results {
  padding: 10px 8px;
  font-size: 12.5px;
  color: var(--text-tertiary);
}
.selected-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  font-size: 13px;
}
.selected-chip img {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
}
.selected-chip span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.clear-btn {
  all: unset;
  display: flex;
  cursor: pointer;
  color: var(--text-tertiary);
  padding: 2px;
  flex-shrink: 0;
}
.clear-btn:hover {
  color: var(--text-primary);
}
</style>
