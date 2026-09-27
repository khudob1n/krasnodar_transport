<template>
  <div class="editor">
    <div class="row">
      <label class="field id-field">
        <span>ID <i class="field-key">не редактируется</i></span>
        <input :value="modelValue.id" type="text" disabled />
      </label>
      <label class="field">
        <span>Вид транспорта</span>
        <select v-model="type" :disabled="disabled" @change="emitUpdate">
          <option value="Автобус">Автобус</option>
          <option value="Трамвай">Трамвай</option>
          <option value="Троллейбус">Троллейбус</option>
        </select>
      </label>
      <label class="field">
        <span>Номер маршрута</span>
        <input v-model="number" type="text" :disabled="disabled" @input="emitUpdate" />
      </label>
      <label class="field">
        <span>Короткое имя</span>
        <input v-model="shortName" type="text" :disabled="disabled" @input="emitUpdate" />
      </label>
    </div>
    <div class="row">
      <label class="field wide-field">
        <span>Название</span>
        <input v-model="name" type="text" :disabled="disabled" @input="emitUpdate" />
      </label>
    </div>
    <div class="row">
      <label class="field">
        <span>Откуда</span>
        <input v-model="fromStation" type="text" :disabled="disabled" @input="emitUpdate" />
      </label>
      <label class="field">
        <span>Куда</span>
        <input v-model="toStation" type="text" :disabled="disabled" @input="emitUpdate" />
      </label>
    </div>

    <section v-for="(dir, i) in directions" :key="dir.subrouteId" class="block">
      <h2>{{ dir.forward ? 'Прямое направление' : 'Обратное направление' }} — остановки по порядку</h2>
      <RouteDirectionEditor
        v-model="directions[i]"
        :stop-options="stopOptions"
        :disabled="disabled"
        @update="emitUpdate"
        @update:valid="directionsValid[i] = $event"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
type StationEntry = { id: number; name: string; lat: number; lng: number };
type Direction = { subrouteId: number; directionTo: string; forward: boolean; stopsCount: number; stations: StationEntry[] };
type RouteStopsData = {
  id: number;
  type: string;
  number: string;
  shortName: string;
  name: string;
  fromStation: string;
  toStation: string;
  directions: Direction[];
};
type Stop = { id: number; name: string; lat: number; lng: number };

const props = defineProps<{ modelValue: RouteStopsData; disabled: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: RouteStopsData): void; (e: 'update:valid', valid: boolean): void }>();

const { fetchAllRecords } = useCollectionRecords();

const type = ref(props.modelValue.type);
const number = ref(props.modelValue.number);
const shortName = ref(props.modelValue.shortName);
const name = ref(props.modelValue.name);
const fromStation = ref(props.modelValue.fromStation);
const toStation = ref(props.modelValue.toStation);
const directions = ref<Direction[]>(props.modelValue.directions.map((d) => ({ ...d, stations: d.stations.map((s) => ({ ...s })) })));
const stopOptions = ref<Stop[]>([]);
const directionsValid = ref<boolean[]>(directions.value.map(() => true));

const isValid = computed(() => directionsValid.value.every((v) => v));
watch(isValid, (v) => emit('update:valid', v), { immediate: true });

function emitUpdate() {
  if (!isValid.value) return;
  emit('update:modelValue', {
    id: props.modelValue.id,
    type: type.value,
    number: number.value,
    shortName: shortName.value,
    name: name.value,
    fromStation: fromStation.value,
    toStation: toStation.value,
    directions: directions.value,
  });
}

onMounted(async () => {
  try {
    stopOptions.value = await fetchAllRecords<Stop>('ground_transport/stops');
    stopOptions.value.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  } catch {
    // pickers just stay empty if stops can't be loaded - existing rows keep their value
  }
});
</script>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.row .field {
  flex: 1 1 140px;
}
.id-field {
  flex: 0 1 100px;
}
.wide-field {
  flex: 1 1 100%;
}
.field-key {
  font-style: normal;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-tertiary);
}
.block {
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
.block h2 {
  margin: 0 0 10px;
  font-size: 14.5px;
}
</style>
