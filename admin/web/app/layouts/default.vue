<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <img src="/design/logo-mark.svg" alt="" class="brand-mark" />
        <span>Транспорт Краснодара<br /><small>Панель управления</small></span>
      </div>

      <nav>
        <NuxtLink to="/" class="nav-link">
          <AppIcon name="dashboard" />
          Главная
        </NuxtLink>
        <NuxtLink to="/live" class="nav-link">
          <AppIcon name="pulse" />
          Транспорт в реальном времени
        </NuxtLink>
        <NuxtLink to="/map" class="nav-link">
          <AppIcon name="map" />
          Карта
        </NuxtLink>
        <NuxtLink to="/history" class="nav-link">
          <AppIcon name="clock" />
          История перемещения транспорта
        </NuxtLink>
        <NuxtLink v-if="isAdmin" to="/users" class="nav-link">
          <AppIcon name="users" />
          Пользователи
        </NuxtLink>

        <div class="nav-divider"></div>
        <div class="nav-section-title">
          <AppIcon name="layers" :size="14" />
          Справочные данные
        </div>

        <div v-for="group in TRANSPORT_NAV_GROUPS" :key="group.code" class="nav-group">
          <button type="button" class="nav-group-toggle" @click="toggleGroup(group.code)">
            <span class="nav-group-toggle-label"><img :src="group.icon" class="nav-group-icon" alt="" /> {{ group.label }}</span>
            <AppIcon name="chevron-down" :size="14" :class="{ collapsed: !isOpen(group.code) }" />
          </button>
          <div v-show="isOpen(group.code)" class="nav-group-items">
            <NuxtLink
              v-for="l in group.links"
              :key="l.label + JSON.stringify(l.query)"
              :to="{ path: l.to, query: l.query }"
              class="nav-sublink"
              :class="{ active: isLinkActive(l) }"
            >
              {{ l.label }}
            </NuxtLink>
          </div>
        </div>

        <div class="nav-group">
          <button type="button" class="nav-group-toggle" @click="toggleGroup('metro')">
            <span class="nav-group-toggle-label"><img src="/design/icons/metro.svg" class="nav-group-icon" alt="" /> Метро</span>
            <AppIcon name="chevron-down" :size="14" :class="{ collapsed: !isOpen('metro') }" />
          </button>
          <div v-show="isOpen('metro')" class="nav-group-items">
            <NuxtLink
              v-for="l in METRO_NAV_LINKS"
              :key="l.to"
              :to="{ path: l.to }"
              class="nav-sublink"
              :class="{ active: isLinkActive(l) }"
            >
              {{ l.label }}
            </NuxtLink>
          </div>
        </div>

        <NuxtLink to="/data" class="nav-link nav-all-link">
          <AppIcon name="inbox" :size="16" />
          Все датасеты
        </NuxtLink>
      </nav>

      <div class="account">
        <div class="avatar">{{ initials }}</div>
        <div class="account-info">
          <div class="email">{{ user?.email }}</div>
          <span class="role-pill" :class="{ admin: user?.role === 'ADMIN' }">
            {{ user?.role === 'ADMIN' ? 'Администратор' : 'Наблюдатель' }}
          </span>
        </div>
        <button class="ghost logout-btn" title="Выйти" @click="onLogout">
          <AppIcon name="logout" :size="17" />
        </button>
      </div>
    </aside>
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { user, isAdmin, logout } = useAuth();
const currentRoute = useRoute();

// NuxtLink's built-in active-class matching only compares the route path, not the query
// string - without this, the three type-filtered "Маршруты" links (one per transport type)
// would all show as active at once whenever any of them is open.
function isLinkActive(link: NavLink) {
  if (currentRoute.path !== link.to) return false;
  const query = link.query || {};
  return Object.entries(query).every(([k, v]) => currentRoute.query[k] === v);
}

const openGroups = useState<Record<string, boolean>>('nav:openGroups', () => ({}));
function isOpen(namespace: string) {
  return openGroups.value[namespace] ?? true;
}
function toggleGroup(namespace: string) {
  openGroups.value = { ...openGroups.value, [namespace]: !isOpen(namespace) };
}

const initials = computed(() => {
  const email = user.value?.email || '';
  return email.slice(0, 2).toUpperCase();
});

async function onLogout() {
  await logout();
  await navigateTo('/login');
}
</script>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
}
.sidebar {
  width: 248px;
  flex-shrink: 0;
  background: var(--ekb-sidebar);
  color: #dfe3ea;
  display: flex;
  flex-direction: column;
  padding: 18px 14px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 14px;
  line-height: 1.25;
  padding: 2px 8px 18px;
  border-bottom: 1px solid #202227;
  margin-bottom: 14px;
}
.brand-mark {
  width: 26px;
  height: auto;
  flex-shrink: 0;
}
.brand small {
  font-weight: 400;
  color: #7b8290;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  padding: 8px 9px;
  border-radius: var(--radius-sm);
  color: #c3c9d3;
  font-size: 13.5px;
  font-weight: 500;
}
.nav-link :deep(svg) {
  flex-shrink: 0;
  opacity: 0.85;
}
.nav-link:hover {
  background: #1a1c21;
  color: #fff;
}
.nav-link.router-link-exact-active {
  background: var(--ekb-accent);
  color: var(--ekb-accent-contrast);
}
.nav-link.router-link-exact-active :deep(svg) {
  opacity: 1;
}

.nav-divider {
  height: 1px;
  background: #202227;
  margin: 12px 4px 10px;
}
.nav-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #656b78;
  padding: 0 9px 6px;
}

.nav-group {
  margin-bottom: 1px;
}
.nav-group-toggle {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 9px;
  border-radius: var(--radius-sm);
  color: #8991a0;
  font-size: 12.5px;
  cursor: pointer;
  box-sizing: border-box;
}
.nav-group-toggle:hover {
  background: #1a1c21;
  color: #dfe3ea;
}
.nav-group-toggle-label {
  display: flex;
  align-items: center;
  gap: 7px;
}
.nav-group-icon {
  width: 15px;
  height: 15px;
  object-fit: contain;
  flex-shrink: 0;
}
.nav-group-toggle :deep(svg) {
  transition: transform 0.15s ease;
}
.nav-group-toggle :deep(svg.collapsed) {
  transform: rotate(-90deg);
}
.nav-group-items {
  display: flex;
  flex-direction: column;
  padding-left: 8px;
  border-left: 1px solid #202227;
  margin-left: 13px;
}
.nav-sublink {
  text-decoration: none;
  padding: 6px 9px;
  border-radius: var(--radius-sm);
  color: #9aa0ac;
  font-size: 13px;
}
.nav-sublink:hover {
  background: #1a1c21;
  color: #fff;
}
.nav-sublink.active {
  background: #1e2026;
  color: var(--ekb-accent);
  font-weight: 500;
}
.nav-all-link {
  margin-top: 8px;
  color: #7b8290;
  font-size: 12.5px;
  font-weight: 400;
}

.account {
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid #202227;
  padding-top: 14px;
  margin-top: 12px;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1e2026;
  color: #c3c9d3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.account-info {
  flex: 1;
  min-width: 0;
}
.email {
  font-size: 12.5px;
  color: #dfe3ea;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.role-pill {
  display: inline-block;
  margin-top: 3px;
  font-size: 11px;
  color: #9aa0ac;
  background: #1e2026;
  padding: 1px 7px;
  border-radius: 100px;
}
.role-pill.admin {
  color: var(--ekb-accent-contrast);
  background: var(--ekb-accent);
}
.logout-btn {
  color: #8991a0;
  padding: 7px;
  flex-shrink: 0;
}
.logout-btn:hover {
  background: #1e2026;
  color: #fff;
}

.content {
  flex: 1;
  padding: 28px 32px;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}
</style>
