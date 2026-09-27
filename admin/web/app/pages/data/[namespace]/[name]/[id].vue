<template>
  <div>
    <NuxtLink :to="`/data/${collectionKey}`" class="breadcrumb">
      <AppIcon name="arrow-right" :size="13" style="transform: rotate(180deg)" />
      {{ collectionLabel || collectionKey }}
    </NuxtLink>

    <div class="head">
      <div>
        <h1>{{ isNew ? 'Новая запись' : isSingle ? collectionLabel || recordKeyLabel : `Запись ${recordKeyLabel}` }}</h1>
        <p class="page-subtitle" style="margin-bottom: 0">{{ isAdmin ? 'Можно редактировать все поля' : 'Только просмотр' }}</p>
      </div>
      <span v-if="saved" class="saved-msg"><AppIcon name="check" :size="15" /> Сохранено</span>
    </div>

    <p v-if="error" class="error" style="max-width: 560px">{{ error }}</p>

    <div class="layout" v-if="isMetroLines && metroLineData">
      <div class="card form wide">
        <MetroLineEditor v-model="metroLineData" :disabled="!isAdmin" @update:valid="customEditorValid = $event" />
        <div class="actions" v-if="isAdmin">
          <button class="primary" @click="save" :disabled="saving || !customEditorValid">
            <AppIcon name="check" :size="15" /> {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>

    <div class="layout" v-else-if="isMetroSchedule && metroScheduleData">
      <div class="card form wide">
        <MetroScheduleEditor v-model="metroScheduleData" :disabled="!isAdmin" @update:valid="customEditorValid = $event" />
        <div class="actions" v-if="isAdmin">
          <button class="primary" @click="save" :disabled="saving || !customEditorValid">
            <AppIcon name="check" :size="15" /> {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>

    <div class="layout" v-else-if="isRouteStops && routeStopsData">
      <div class="card form wide">
        <RouteStopsEditor v-model="routeStopsData" :disabled="!isAdmin" @update:valid="customEditorValid = $event" />
        <div class="actions" v-if="isAdmin">
          <button class="primary" @click="save" :disabled="saving || !customEditorValid">
            <AppIcon name="check" :size="15" /> {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
          <button class="danger" @click="remove" :disabled="saving">
            <AppIcon name="trash" :size="15" /> Удалить
          </button>
        </div>
      </div>
    </div>

    <div class="layout" v-else-if="isNew || fields.length">
      <div class="card form">
        <label v-if="isNew" class="field">
          <span>Ключ записи <i class="field-key">recordKey</i></span>
          <input v-model="newRecordKey" type="text" :disabled="!isAdmin" placeholder="Оставьте пустым — сгенерируется автоматически" />
        </label>

        <template v-if="isNew">
          <label class="field">
            <span>Данные (JSON)</span>
            <textarea v-model="newJson" rows="14" :disabled="!isAdmin"></textarea>
          </label>
        </template>

        <template v-else>
          <label v-for="f in fields" :key="f.key" class="field">
            <span>{{ fieldLabel(collectionKey, f.key) }} <i class="field-key">{{ f.key }}</i></span>
            <input v-if="f.type === 'number'" v-model.number="f.value" type="number" :disabled="!isAdmin" />
            <span v-else-if="f.type === 'boolean'" class="switch-row">
              <label class="switch">
                <input v-model="f.value" type="checkbox" :disabled="!isAdmin" />
                <span class="switch-track"></span>
              </label>
              {{ f.value ? 'да' : 'нет' }}
            </span>
            <textarea v-else-if="f.type === 'json'" v-model="f.value" rows="6" :disabled="!isAdmin"></textarea>
            <input v-else v-model="f.value" type="text" :disabled="!isAdmin" />
          </label>
        </template>

        <div class="actions" v-if="isAdmin">
          <button class="primary" @click="save" :disabled="saving">
            <AppIcon name="check" :size="15" /> {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
          <button v-if="!isNew && !isSingle" class="danger" @click="remove" :disabled="saving">
            <AppIcon name="trash" :size="15" /> Удалить
          </button>
        </div>
      </div>

      <div class="card map-card" v-if="pointFields">
        <h2>Расположение на карте</h2>
        <PointMiniMap :lat="pointFields.lat.value" :lng="pointFields.lng.value" :editable="isAdmin" @update="onPointUpdate" />
        <p class="hint" v-if="isAdmin">Перетащите точку, чтобы изменить координаты.</p>
      </div>

      <div class="card map-card" v-if="polylineField">
        <h2>Геометрия маршрута на карте</h2>
        <PolylinePreviewMap :points="polylineField.points" />
        <p class="hint">Только просмотр — редактируется через поле «{{ fieldLabel(collectionKey, polylineField.key) }}» слева.</p>
      </div>
    </div>
    <div v-else class="empty-state">
      <AppIcon name="inbox" :size="28" class="icon" />
      <div>Загрузка…</div>
    </div>
  </div>
</template>

<script setup lang="ts">
type FieldType = 'string' | 'number' | 'boolean' | 'json';
type Field = { key: string; type: FieldType; value: any };

const route = useRoute();
const { api } = useApi();
const { isAdmin } = useAuth();

const collectionKey = computed(() => `${route.params.namespace}/${route.params.name}`);
const id = computed(() => String(route.params.id));
const isNew = computed(() => id.value === 'new');
const isMetroLines = computed(() => collectionKey.value === 'metro/lines');
const isMetroSchedule = computed(() => collectionKey.value === 'metro/schedule_info');
const isRouteStops = computed(() => collectionKey.value === 'ground_transport/route_stops');

const fields = ref<Field[]>([]);
const metroLineData = ref<any>(null);
const metroScheduleData = ref<any>(null);
const routeStopsData = ref<any>(null);
const customEditorValid = ref(true);
const recordKeyLabel = ref('');
const isSingle = ref(false);
const collectionLabel = ref('');
const newRecordKey = ref('');
const newJson = ref('{\n  \n}');
const error = ref('');
const saved = ref(false);
const saving = ref(false);

function fieldTypeOf(value: unknown): FieldType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value !== null && typeof value === 'object') return 'json';
  return 'string';
}

function toFields(data: Record<string, any>): Field[] {
  return Object.entries(data).map(([key, value]) => ({
    key,
    type: fieldTypeOf(value),
    value: fieldTypeOf(value) === 'json' ? JSON.stringify(value, null, 2) : value,
  }));
}

function fieldsToData(): Record<string, any> {
  const data: Record<string, any> = {};
  for (const f of fields.value) {
    data[f.key] = f.type === 'json' ? JSON.parse(f.value) : f.value;
  }
  return data;
}

const pointFields = computed(() => {
  const lat = fields.value.find((f) => f.key === 'lat' && f.type === 'number');
  const lng = fields.value.find((f) => f.key === 'lng' && f.type === 'number');
  return lat && lng ? { lat, lng } : null;
});

function onPointUpdate(point: { lat: number; lng: number }) {
  if (!pointFields.value) return;
  pointFields.value.lat.value = point.lat;
  pointFields.value.lng.value = point.lng;
}

// Detects a json field that holds an array of {lat,lng} points (e.g. route geometry)
// so it can be previewed as a polyline instead of a raw textarea-only blob.
const polylineField = computed(() => {
  for (const f of fields.value) {
    if (f.type !== 'json') continue;
    try {
      const parsed = JSON.parse(f.value);
      if (Array.isArray(parsed) && parsed.length > 1 && typeof parsed[0]?.lat === 'number' && typeof parsed[0]?.lng === 'number') {
        return { key: f.key, points: parsed as { lat: number; lng: number }[] };
      }
    } catch {
      // not valid/relevant JSON - ignore
    }
  }
  return null;
});

async function load() {
  if (isNew.value) return;
  error.value = '';
  try {
    const res = await api<{ record: { recordKey: string; data: Record<string, any>; collection: string } }>(
      `/api/collections/${collectionKey.value}/records/${id.value}`,
    );
    if (isMetroLines.value) {
      metroLineData.value = res.record.data;
    } else if (isMetroSchedule.value) {
      metroScheduleData.value = res.record.data;
    } else if (isRouteStops.value) {
      routeStopsData.value = res.record.data;
    } else {
      fields.value = toFields(res.record.data);
    }
    recordKeyLabel.value = res.record.recordKey;
  } catch (err: any) {
    error.value = err.message;
  }
}

async function loadMeta() {
  try {
    const res = await api<{ collections: { key: string; label: string; single: boolean }[] }>('/api/collections');
    const found = res.collections.find((c) => c.key === collectionKey.value);
    isSingle.value = Boolean(found?.single);
    collectionLabel.value = found?.label || collectionKey.value;
  } catch {
    // non-critical
  }
}

async function save() {
  error.value = '';
  saved.value = false;
  saving.value = true;
  try {
    if (isNew.value) {
      let data: Record<string, any>;
      try {
        data = JSON.parse(newJson.value);
      } catch {
        throw new Error('Некорректный JSON');
      }
      const res = await api<{ record: { id: string } }>(`/api/collections/${collectionKey.value}/records`, {
        method: 'POST',
        body: { data, recordKey: newRecordKey.value || undefined },
      });
      await navigateTo(`/data/${collectionKey.value}/${res.record.id}`);
      return;
    }
    let data: Record<string, any>;
    if (isMetroLines.value) {
      data = metroLineData.value;
    } else if (isMetroSchedule.value) {
      data = metroScheduleData.value;
    } else if (isRouteStops.value) {
      data = routeStopsData.value;
    } else {
      try {
        data = fieldsToData();
      } catch {
        throw new Error('Некорректный JSON в одном из полей');
      }
    }
    await api(`/api/collections/${collectionKey.value}/records/${id.value}`, {
      method: 'PATCH',
      body: { data },
    });
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
  } catch (err: any) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!confirm('Удалить запись без возможности восстановления?')) return;
  try {
    await api(`/api/collections/${collectionKey.value}/records/${id.value}`, { method: 'DELETE' });
    await navigateTo(`/data/${collectionKey.value}`);
  } catch (err: any) {
    error.value = err.message;
  }
}

onMounted(() => {
  loadMeta();
  load();
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
.saved-msg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  padding-top: 4px;
}
.layout {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.form {
  max-width: 560px;
  flex: 1 1 400px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form.wide {
  max-width: 720px;
}
.map-card {
  width: 320px;
  flex: 0 0 320px;
}
.map-card .hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 8px 0 0;
}
textarea {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.field-key {
  font-style: normal;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-tertiary);
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.switch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
