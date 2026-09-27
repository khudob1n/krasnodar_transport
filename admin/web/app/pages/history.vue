<template>
  <div>
    <h1>История перемещения транспорта</h1>
    <p class="page-subtitle">Архив сырых GPS-фиксаций по дням — для разбора конкретного ТС или маршрута.</p>

    <div class="card toolbar">
      <label class="field" style="width: 240px">
        <span>День</span>
        <select v-model="selectedDay">
          <option v-for="d in days" :key="d.day" :value="d.day">
            {{ formatDay(d.day) }} · {{ formatSize(d.sizeBytes) }}{{ d.compressed ? ', сжато' : '' }}
          </option>
        </select>
      </label>
      <label class="field" style="width: 160px">
        <span>ID устройства</span>
        <input v-model="deviceCode" type="text" placeholder="Любой" />
      </label>
      <label class="field" style="width: 140px">
        <span>ID маршрута</span>
        <input v-model="routeId" type="text" placeholder="Любой" />
      </label>
      <button class="primary" @click="load" :disabled="!selectedDay || loading" style="align-self: flex-end">
        {{ loading ? 'Загрузка…' : 'Показать' }}
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="result" class="result-summary">
      Найдено <strong>{{ result.matched.toLocaleString('ru-RU') }}</strong> фиксаций, показано
      <strong>{{ result.returned.toLocaleString('ru-RU') }}</strong> (лимит {{ result.limit }}).
    </p>

    <div class="card no-pad">
      <div class="table-scroll">
        <table v-if="result?.rows.length">
          <thead>
            <tr>
              <th>Время</th>
              <th>ID устройства</th>
              <th class="numeric">ID маршрута</th>
              <th class="numeric">Подмаршрут</th>
              <th>Координаты</th>
              <th class="numeric">Скорость</th>
              <th class="numeric">Курс</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in result.rows" :key="i">
              <td class="mono" :title="row.t">{{ formatFixTime(row.t) }}</td>
              <td class="mono muted">{{ row.dc }}</td>
              <td class="numeric mono">{{ row.rid }}</td>
              <td class="numeric mono muted">{{ row.sr }}</td>
              <td class="mono muted">{{ row.lat.toFixed(5) }}, {{ row.lng.toFixed(5) }}</td>
              <td class="numeric mono">{{ row.sp }} км/ч</td>
              <td class="numeric mono">{{ row.dir }}°</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          <AppIcon name="inbox" :size="28" class="icon" />
          <div>{{ loading ? 'Загрузка…' : 'Нет фиксаций по заданным условиям' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type Day = { day: string; compressed: boolean; sizeBytes: number };
type HistoryRow = { t: string; dc: string; rid: number; sr: number; lat: number; lng: number; sp: number; dir: number };
type HistoryResult = { matched: number; returned: number; limit: number; rows: HistoryRow[] };

const { api } = useApi();
const days = ref<Day[]>([]);
const selectedDay = ref('');
const deviceCode = ref('');
const routeId = ref('');
const result = ref<HistoryResult | null>(null);
const error = ref('');
const loading = ref(false);

function formatSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${(bytes / 1024).toFixed(0)} КБ`;
}
function formatFixTime(t: string) {
  return t?.slice(11, 19) || t;
}
function formatDay(day: string) {
  return new Date(day).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', weekday: 'short' });
}

async function load() {
  if (!selectedDay.value) return;
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    if (deviceCode.value) params.set('deviceCode', deviceCode.value);
    if (routeId.value) params.set('routeId', routeId.value);
    result.value = await api<HistoryResult>(`/api/history/${selectedDay.value}?${params.toString()}`);
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    const res = await api<{ days: Day[] }>('/api/history/days');
    days.value = res.days;
    if (days.value[0]) {
      selectedDay.value = days.value[0].day;
      await load();
    }
  } catch (err: any) {
    error.value = err.message;
  }
});
</script>

<style scoped>
h1 {
  margin-top: 0;
}
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.result-summary {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 12px;
}
.no-pad {
  padding: 0;
  overflow: hidden;
}
</style>
