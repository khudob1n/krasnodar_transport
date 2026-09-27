<template>
  <div class="chip-filter">
    <div class="chip-filter-label">
      <AppIcon v-if="groupIcon" :name="groupIcon" :size="13" />
      {{ label }}
    </div>
    <div class="chip-row">
      <button type="button" class="chip" :class="{ active: !modelValue }" @click="$emit('update:modelValue', '')">
        Все
      </button>
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="chip"
        :class="{ active: modelValue === opt.value }"
        @click="$emit('update:modelValue', modelValue === opt.value ? '' : opt.value)"
      >
        <img v-if="icons" :src="routeTypeIcon(opt.value) ?? undefined" class="chip-icon" alt="" />
        <span v-else-if="dots" class="chip-dot" :style="{ background: routeTypeColor(opt.value) }"></span>
        {{ opt.value }}
        <span class="chip-count">{{ opt.count }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  groupIcon?: string;
  options: { value: string; count: number }[];
  modelValue: string;
  icons?: boolean;
  dots?: boolean;
}>();
defineEmits<{ (e: 'update:modelValue', value: string): void }>();
</script>

<style scoped>
.chip-filter {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.chip-filter-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.chip-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 11px;
  border-radius: 100px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.chip:hover {
  border-color: var(--text-secondary);
}
.chip.active {
  background: var(--text-primary);
  border-color: var(--text-primary);
  color: #fff;
}
.chip-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}
.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.chip-count {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
.chip.active .chip-count {
  color: #c7cad0;
}
</style>
