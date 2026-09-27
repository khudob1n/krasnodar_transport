<template>
  <div>
    <h1>Справочные данные</h1>
    <p class="page-subtitle">Маршруты, остановки, расписания и метро — просмотр и редактирование.</p>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-for="group in groups" :key="group.namespace">
      <h2 class="section-title">{{ group.label }}</h2>
      <div class="grid">
        <NuxtLink v-for="c in group.items" :key="c.key" :to="`/data/${c.key}`" class="card tile">
          <div class="tile-icon">
            <img v-if="iconSrcFor(c.key)" :src="iconSrcFor(c.key)!" class="tile-icon-img" alt="" />
            <AppIcon v-else :name="iconFor(c.key)" :size="20" />
          </div>
          <div class="tile-body">
            <div class="tile-title">{{ c.label }}</div>
            <div class="tile-count">{{ c.recordCount.toLocaleString('ru-RU') }} {{ c.single ? '' : 'записей' }}</div>
          </div>
          <AppIcon name="arrow-right" :size="16" class="tile-arrow" />
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const { groups, loaded, load, collections } = useCollections();
const error = ref('');

function iconFor(key: string) {
  if (key.includes('stop') || key.includes('station') || key.includes('entrance')) return 'pin-marker';
  if (key.includes('schedule')) return 'clock';
  if (key.includes('route')) return 'map';
  return 'layers';
}

function iconSrcFor(key: string) {
  if (key === 'metro/stations') return '/design/icons/metro.svg';
  if (key === 'metro/entrances') return '/design/icons/entrance.svg';
  return null;
}

onMounted(async () => {
  if (loaded.value) return;
  try {
    await load();
  } catch (err: any) {
    error.value = err.message;
  }
});
</script>

<style scoped>
h1 {
  margin-top: 0;
}
.section-title {
  color: var(--text-secondary);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  margin: 24px 0 12px;
}
.section-title:first-of-type {
  margin-top: 4px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.tile {
  display: flex;
  align-items: center;
  gap: 14px;
  text-decoration: none;
  color: var(--text-primary);
  transition: border-color 0.12s ease, transform 0.08s ease;
}
.tile:hover {
  border-color: var(--ekb-accent);
  transform: translateY(-1px);
}
.tile-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--surface-sunken);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.tile-icon-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
.tile-body {
  flex: 1;
  min-width: 0;
}
.tile-title {
  font-weight: 600;
  font-size: 13.5px;
}
.tile-count {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
.tile-arrow {
  color: var(--text-tertiary);
  flex-shrink: 0;
}
</style>
