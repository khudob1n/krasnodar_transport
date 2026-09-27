<template>
  <div>
    <h1>Транспорт в реальном времени</h1>
    <p class="page-subtitle">Текущее местоположение транспорта</p>

    <div class="card toolbar">
      <div class="toolbar-row">
        <div class="search">
          <AppIcon name="search" :size="16" />
          <input v-model="filter" type="search" placeholder="Номер маршрута или госномер…" />
        </div>
        <span class="hint">{{ filtered.length }} из {{ vehicles.length }}</span>
      </div>

      <div class="toolbar-filters">
        <label
          v-for="t in typeOptions"
          :key="t.code"
          class="pill-toggle"
          :class="{ active: activeTypes.has(t.code) }"
        >
          <input type="checkbox" :checked="activeTypes.has(t.code)" @change="toggleType(t.code)" />
          <img :src="t.icon" class="pill-icon" alt="" />
          {{ t.label }}
          <span class="count">{{ countByType[t.code] || 0 }}</span>
        </label>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="card no-pad">
      <div class="table-scroll">
        <table v-if="filtered.length">
          <thead>
            <tr>
              <th>Маршрут</th>
              <th>Госномер</th>
              <th class="numeric">Скорость</th>
              <th class="numeric">Курс</th>
              <th>Координаты</th>
              <th>Фиксация</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in filtered" :key="v.deviceCode">
              <td>
                <span class="type-badge" :style="{ background: routeTypeColor(v.routeType) }">{{ v.routeNumber }}</span>
              </td>
              <td class="mono">{{ v.gosNum }}</td>
              <td class="numeric mono">{{ v.speed }} км/ч</td>
              <td class="numeric mono">{{ v.dir }}°</td>
              <td class="mono muted">{{ v.lat?.toFixed(5) }}, {{ v.lng?.toFixed(5) }}</td>
              <td class="mono muted">{{ formatTime(v.navTime) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          <AppIcon name="inbox" :size="28" class="icon" />
          <div>{{ vehicles.length ? 'Ничего не найдено по этому фильтру' : 'Пока нет данных с прокси-сервера' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type Vehicle = {
  deviceCode: string;
  gosNum: string;
  routeNumber: string;
  routeType: string;
  lat: number;
  lng: number;
  speed: number;
  dir: number;
  navTime: string;
};

const { api } = useApi();
const vehicles = ref<Vehicle[]>([]);
const error = ref('');
const filter = ref('');
let timer: ReturnType<typeof setInterval> | undefined;

const typeOptions = [
  { code: 'А', label: 'Автобус', icon: ROUTE_TYPE_ICON['А'] },
  { code: 'Тм', label: 'Трамвай', icon: ROUTE_TYPE_ICON['Тм'] },
  { code: 'Тб', label: 'Троллейбус', icon: ROUTE_TYPE_ICON['Тб'] },
];
const activeTypes = ref(new Set(['А', 'Тм', 'Тб']));
function toggleType(code: string) {
  const next = new Set(activeTypes.value);
  next.has(code) ? next.delete(code) : next.add(code);
  activeTypes.value = next;
}

const countByType = computed(() => {
  const counts: Record<string, number> = {};
  for (const v of vehicles.value) counts[v.routeType] = (counts[v.routeType] || 0) + 1;
  return counts;
});

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  return vehicles.value.filter((v) => {
    if (!activeTypes.value.has(v.routeType)) return false;
    if (!q) return true;
    return v.routeNumber?.toLowerCase().includes(q) || v.gosNum?.toLowerCase().includes(q);
  });
});

function formatTime(navTime: string) {
  return navTime?.slice(11, 19) || '—';
}

async function load() {
  try {
    const res = await api<{ vehicles: Vehicle[] }>('/api/live/vehicles');
    vehicles.value = res.vehicles;
    error.value = '';
  } catch (err: any) {
    error.value = err.message;
  }
}

onMounted(() => {
  load();
  timer = setInterval(load, 5000);
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
h1 {
  margin-top: 0;
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
  gap: 10px;
}
.toolbar-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.search {
  position: relative;
  width: 260px;
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
.pill-icon {
  width: 19px;
  height: 19px;
  object-fit: contain;
}
.pill-toggle .count {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
.pill-toggle.active .count {
  color: #cfd3da;
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
.type-badge {
  display: inline-flex;
  padding: 3px 10px;
  border-radius: 100px;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
}
</style>
