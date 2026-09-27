<template>
  <div>
    <h1>Главная</h1>
    <p class="page-subtitle">Общее состояние прокси-сервера и данных транспортной сети.</p>

    <div class="stats">
      <div class="card stat">
        <div class="stat-icon" :class="proxyOk ? 'ok' : 'error'">
          <AppIcon name="pulse" :size="20" />
        </div>
        <div class="stat-body">
          <div class="stat-label">
            <span class="status-dot" :class="proxyOk ? 'ok' : 'error'"></span>
            Прокси-сервер
          </div>
          <div v-if="healthError" class="stat-value error-value">Недоступен</div>
          <template v-else-if="health">
            <div class="stat-value">{{ health.vehiclesTracked }} <span class="stat-unit">ТС на линии</span></div>
            <div class="stat-caption">
              Опрошено: {{ health.lastPollAt ? new Date(health.lastPollAt).toLocaleTimeString('ru-RU') : '—' }}
            </div>
          </template>
          <div v-else class="stat-value">…</div>
        </div>
      </div>

      <NuxtLink to="/data" class="card stat stat-link">
        <div class="stat-icon accent">
          <AppIcon name="layers" :size="20" />
        </div>
        <div class="stat-body">
          <div class="stat-label">Справочные данные</div>
          <div class="stat-value">{{ totalRecords.toLocaleString('ru-RU') }} <span class="stat-unit">записей</span></div>
          <div class="stat-caption">{{ collections.length }} датасетов — маршруты, остановки, расписания</div>
        </div>
      </NuxtLink>

      <NuxtLink to="/live" class="card stat stat-link">
        <div class="stat-icon neutral">
          <AppIcon name="map" :size="20" />
        </div>
        <div class="stat-body">
          <div class="stat-label">Карта города</div>
          <div class="stat-value">{{ stopsCount || '—' }} <span class="stat-unit">остановок</span></div>
          <div class="stat-caption">+ станции и входы метро</div>
        </div>
      </NuxtLink>
    </div>

    <p v-if="healthError" class="error" style="max-width: 480px">Не удалось получить данные с прокси-сервера: {{ healthError }}</p>
    <p v-else-if="health?.lastPollError" class="error" style="max-width: 480px">
      Последний опрос завершился ошибкой: {{ health.lastPollError }}
    </p>

    <h2 class="section-title">Разделы</h2>
    <div class="tiles">
      <NuxtLink to="/live" class="tile">
        <AppIcon name="pulse" :size="22" />
        <div>
          <div class="tile-title">Транспорт в реальном времени</div>
          <div class="tile-caption">Текущие позиции ТС на линии</div>
        </div>
      </NuxtLink>
      <NuxtLink to="/map" class="tile">
        <AppIcon name="map" :size="22" />
        <div>
          <div class="tile-title">Карта</div>
          <div class="tile-caption">ТС, остановки, метро и геометрия маршрутов</div>
        </div>
      </NuxtLink>
      <NuxtLink to="/history" class="tile">
        <AppIcon name="clock" :size="22" />
        <div>
          <div class="tile-title">История перемещения транспорта</div>
          <div class="tile-caption">Архив GPS-фиксаций по дням</div>
        </div>
      </NuxtLink>
      <NuxtLink to="/data" class="tile">
        <AppIcon name="layers" :size="22" />
        <div>
          <div class="tile-title">Справочные данные</div>
          <div class="tile-caption">Маршруты, остановки, расписания, метро</div>
        </div>
      </NuxtLink>
      <NuxtLink v-if="isAdmin" to="/users" class="tile">
        <AppIcon name="users" :size="22" />
        <div>
          <div class="tile-title">Пользователи</div>
          <div class="tile-caption">Доступ к админке и роли</div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
type Health = { status: string; vehiclesTracked: number; lastPollAt: string | null; lastPollError: string | null };
type CollectionInfo = { key: string; label: string; single: boolean; recordCount: number };

const { api } = useApi();
const { isAdmin } = useAuth();

const health = ref<Health | null>(null);
const healthError = ref('');
const collections = ref<CollectionInfo[]>([]);
const stopsCount = ref(0);

const totalRecords = computed(() => collections.value.reduce((sum, c) => sum + c.recordCount, 0));
const proxyOk = computed(() => Boolean(health.value && !healthError.value && !health.value.lastPollError));

onMounted(async () => {
  try {
    health.value = await api<Health>('/api/live/health');
  } catch (err: any) {
    healthError.value = err.message;
  }
  try {
    const res = await api<{ collections: CollectionInfo[] }>('/api/collections');
    collections.value = res.collections;
    stopsCount.value = res.collections.find((c) => c.key === 'ground_transport/stops')?.recordCount || 0;
  } catch {
    // dashboard tile just stays empty
  }
});
</script>

<style scoped>
h1 {
  margin-top: 0;
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-bottom: 32px;
}
.stat {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  text-decoration: none;
  color: inherit;
}
.stat-link {
  transition: border-color 0.12s ease, transform 0.08s ease;
}
.stat-link:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--surface-sunken);
  color: var(--text-secondary);
}
.stat-icon.ok {
  background: #e7f5ea;
  color: var(--ekb-success);
}
.stat-icon.error {
  background: var(--ekb-danger-bg);
  color: var(--ekb-danger);
}
.stat-icon.accent {
  background: #fff8db;
  color: #96780a;
}
.stat-icon.neutral {
  background: #e7f0fb;
  color: #1c6fbf;
}
.stat-body {
  min-width: 0;
}
.stat-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.stat-value.error-value {
  color: var(--ekb-danger);
  font-size: 16px;
}
.stat-unit {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}
.stat-caption {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 3px;
}

.section-title {
  color: var(--text-secondary);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  margin: 0 0 12px;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px;
}
.tile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text-primary);
  transition: border-color 0.12s ease, background 0.12s ease;
}
.tile:hover {
  border-color: var(--ekb-accent);
  background: #fffdf2;
}
.tile :deep(svg) {
  flex-shrink: 0;
  color: var(--text-secondary);
}
.tile-title {
  font-weight: 600;
  font-size: 13.5px;
}
.tile-caption {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}
</style>
