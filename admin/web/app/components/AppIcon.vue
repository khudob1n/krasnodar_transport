<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'dashboard'">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.5" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.5" />
    </template>
    <template v-else-if="name === 'pulse'">
      <path d="M3 12h4l2 7 4-14 2 7h6" />
    </template>
    <template v-else-if="name === 'map'">
      <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13l-5.5 2-6-2Z" />
      <path d="M9 4.5v13" />
      <path d="M15 6.5v13" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </template>
    <template v-else-if="name === 'layers'">
      <path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z" />
      <path d="M3.5 12 12 16.5 20.5 12" />
      <path d="M3.5 16 12 20.5 20.5 16" />
    </template>
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="8" r="3.25" />
      <path d="M2.75 19c.6-3.3 3.1-5 6.25-5s5.65 1.7 6.25 5" />
      <circle cx="17.5" cy="8.5" r="2.5" />
      <path d="M15.5 3.5a3.6 3.6 0 0 1 0 9" opacity="0" />
      <path d="M17.25 12c2.6.2 4.5 1.7 5 4.5" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="m6 9 6 6 6-6" />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M9 4.5H5.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5H9" />
      <path d="M15.5 15.5 20 12l-4.5-3.5" />
      <path d="M20 12H9" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m19.5 19.5-4.3-4.3" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
      <path d="M6.5 7 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 13 4.5 4.5L19.5 7" />
    </template>
    <template v-else-if="name === 'arrow-right'">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </template>
    <template v-else-if="name === 'building'">
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
    </template>
    <template v-else-if="name === 'pin-marker'">
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </template>
    <template v-else-if="name === 'alert'">
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 9.5v5" />
      <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'inbox'">
      <path d="M4 12h4l1.7 3h4.6l1.7-3h4" />
      <path d="M6.5 5.5h11l2.5 6.5v6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18v-6l2.5-6.5Z" />
    </template>
    <template v-else-if="name === 'accessible'">
      <!-- Tabler disabled-2 -->
      <path d="M15 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M9 11a5 5 0 1 0 3.95 7.95" />
      <path d="M19 20l-4 -5h-4l3 -5l-4 -3l-4 1" />
    </template>
    <template v-else-if="name === 'filter'">
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10.5 19h3" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number | string }>(), { size: 18 });
</script>
