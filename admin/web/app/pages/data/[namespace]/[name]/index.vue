<template>
  <div>
    <NuxtLink to="/data" class="breadcrumb">
      <AppIcon name="arrow-right" :size="13" style="transform: rotate(180deg)" />
      Все датасеты
    </NuxtLink>

    <div class="head">
      <div>
        <h1>{{ meta?.label || collectionKey }}</h1>
        <p class="page-subtitle" style="margin-bottom: 0">
          {{ total != null ? `${total.toLocaleString('ru-RU')} записей` : ' ' }}
        </p>
      </div>
      <button v-if="isAdmin && meta && !meta.single" class="primary" @click="createNew">
        <AppIcon name="plus" :size="15" /> Добавить запись
      </button>
    </div>

    <div class="card toolbar">
      <div class="toolbar-row">
        <div class="search">
          <AppIcon name="search" :size="16" />
          <input v-model="q" type="search" placeholder="Поиск по любому полю записи…" @keyup.enter="applyAndReload" />
        </div>
        <button @click="applyAndReload">Найти</button>
        <button v-if="hasActiveFilters" class="ghost" @click="resetFilters">
          <AppIcon name="close" :size="13" /> Сбросить
        </button>
        <span class="hint" v-if="total != null">стр. {{ page }} из {{ pageCount }}</span>
      </div>

      <div v-if="filterDefs.length" class="toolbar-filters">
        <ChipFilter
          v-for="f in filterDefs.filter((d) => d.kind !== 'select')"
          :key="f.field"
          :label="f.label"
          :group-icon="f.groupIcon"
          :icons="f.kind === 'chips-icon'"
          :options="facetOptions[f.field] || []"
          v-model="activeFilters[f.field]"
          @update:model-value="applyAndReload"
        />

        <label v-for="f in filterDefs.filter((d) => d.kind === 'select')" :key="f.field" class="filter-select">
          <span><AppIcon v-if="f.groupIcon" :name="f.groupIcon" :size="13" /> {{ f.label }}</span>
          <select v-model="activeFilters[f.field]" @change="applyAndReload">
            <option value="">Все</option>
            <option v-for="opt in facetOptions[f.field] || []" :key="opt.value" :value="opt.value">
              {{ opt.value }} ({{ opt.count }})
            </option>
          </select>
        </label>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="card no-pad">
      <div class="table-scroll">
        <table v-if="records.length">
          <thead>
            <tr>
              <th v-for="col in columns" :key="col">{{ fieldLabel(collectionKey, col) }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in records" :key="r.id">
              <td v-for="col in columns" :key="col" :class="{ mono: isObject(r.data[col]), muted: isObject(r.data[col]) }">
                {{ preview(r.data[col]) }}
              </td>
              <td class="row-action">
                <NuxtLink :to="`/data/${collectionKey}/${r.id}`">{{ isAdmin ? 'Редактировать' : 'Смотреть' }}</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          <AppIcon name="inbox" :size="28" class="icon" />
          <div>{{ hasActiveFilters ? 'Ничего не найдено по этим условиям' : 'В этом датасете пока нет записей' }}</div>
        </div>
      </div>
    </div>

    <div class="pager" v-if="pageCount > 1">
      <button :disabled="page <= 1" @click="page--; reload()">← Назад</button>
      <span class="page-indicator">{{ page }} / {{ pageCount }}</span>
      <button :disabled="page >= pageCount" @click="page++; reload()">Вперёд →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
type RecordItem = { id: string; recordKey: string; data: Record<string, any> };
type ListResponse = {
  collection: { key: string; label: string; single: boolean };
  page: number;
  pageSize: number;
  total: number;
  records: RecordItem[];
};
type FacetOption = { value: string; count: number };

const route = useRoute();
const { api } = useApi();
const { isAdmin } = useAuth();

const collectionKey = computed(() => `${route.params.namespace}/${route.params.name}`);
const filterDefs = computed(() => COLLECTION_FILTERS[collectionKey.value] || []);

const records = ref<RecordItem[]>([]);
const meta = ref<ListResponse['collection'] | null>(null);
const total = ref<number | null>(null);
const page = ref(1);
const pageSize = 50;
const q = ref('');
const activeFilters = ref<Record<string, string>>({});
const facetOptions = ref<Record<string, FacetOption[]>>({});
const error = ref('');

const pageCount = computed(() => Math.max(Math.ceil((total.value || 0) / pageSize), 1));
const hasActiveFilters = computed(() => Boolean(q.value) || Object.values(activeFilters.value).some(Boolean));

const columns = computed(() => {
  const first = records.value[0];
  return first ? Object.keys(first.data) : [];
});

function isObject(value: unknown) {
  return value !== null && typeof value === 'object';
}

function preview(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  // A nested array (route directions, GPS points, ...) isn't meant to be read as raw JSON in a
  // table cell - a plain "N записей" summary is honest about what's there without dumping it.
  if (Array.isArray(value)) return `${value.length} ${pluralizeRu(value.length, 'запись', 'записи', 'записей')}`;
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    return json.length > 60 ? json.slice(0, 60) + '…' : json;
  }
  return String(value);
}

async function loadFacets() {
  facetOptions.value = {};
  // Init every declared filter field up front, so v-model always binds to a string
  // (not undefined) even before its facet options have loaded. A matching query param
  // (e.g. /data/ground_transport/routes?type=Автобус, from a transport-type nav link)
  // pre-applies that filter on first load.
  const initial: Record<string, string> = {};
  for (const f of filterDefs.value) {
    const fromQuery = route.query[f.field];
    initial[f.field] = (typeof fromQuery === 'string' ? fromQuery : null) ?? activeFilters.value[f.field] ?? '';
  }
  activeFilters.value = initial;

  for (const f of filterDefs.value) {
    try {
      const res = await api<{ field: string; values: FacetOption[] }>(
        `/api/collections/${collectionKey.value}/facets?field=${encodeURIComponent(f.field)}`,
      );
      facetOptions.value[f.field] = res.values;
    } catch {
      // filter just stays empty if facets can't be loaded
    }
  }
}

async function reload() {
  error.value = '';
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) });
    if (q.value) params.set('q', q.value);
    const activeEntries = Object.entries(activeFilters.value).filter(([, v]) => v);
    if (activeEntries.length) params.set('filters', JSON.stringify(Object.fromEntries(activeEntries)));
    const res = await api<ListResponse>(`/api/collections/${collectionKey.value}/records?${params.toString()}`);
    records.value = res.records;
    meta.value = res.collection;
    total.value = res.total;

    // "Линии метро" and "Режим работы метро" are single deeply-nested records with their own
    // editors (MetroLineEditor / MetroScheduleEditor) - the generic table (raw JSON per cell)
    // is unreadable for them, so skip straight to the edit page.
    if ((collectionKey.value === 'metro/lines' || collectionKey.value === 'metro/schedule_info') && records.value[0]) {
      await navigateTo(`/data/${collectionKey.value}/${records.value[0].id}`, { replace: true });
    }
  } catch (err: any) {
    error.value = err.message;
  }
}

function applyAndReload() {
  page.value = 1;
  reload();
}

function resetFilters() {
  q.value = '';
  const cleared: Record<string, string> = {};
  for (const f of filterDefs.value) cleared[f.field] = '';
  activeFilters.value = cleared;
  applyAndReload();
}

function createNew() {
  navigateTo(`/data/${collectionKey.value}/new`);
}

watch(collectionKey, () => {
  page.value = 1;
  q.value = '';
  activeFilters.value = {};
  loadFacets();
  reload();
});
onMounted(() => {
  loadFacets();
  reload();
});
</script>

<style scoped>
.breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-secondary);
  text-decoration: none;
  margin-bottom: 14px;
}
.breadcrumb:hover {
  color: var(--text-primary);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
h1 {
  margin: 0;
}
button.primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.toolbar-filters {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.toolbar-filters:empty {
  display: none;
}
button.ghost {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
}
.search {
  position: relative;
  width: 280px;
}
.search svg {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
}
.search input {
  padding-left: 34px;
}
.filter-select {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.filter-select span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.filter-select select {
  width: auto;
  min-width: 160px;
}
.hint {
  margin-left: auto;
  font-size: 12.5px;
  color: var(--text-tertiary);
}
.no-pad {
  padding: 0;
  overflow: hidden;
}
.row-action a {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}
.row-action a:hover {
  color: var(--ekb-accent-contrast);
  text-decoration: underline;
}
.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}
.page-indicator {
  font-size: 12.5px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
