<template>
  <div>
    <h1>Пользователи</h1>
    <p class="page-subtitle">Кто имеет доступ к админке и что может делать.</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="layout">
      <div class="card no-pad" style="flex: 1 1 480px">
        <div class="table-scroll" style="max-height: none">
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Роль</th>
                <th>Активен</th>
                <th>Создан</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>
                  <div class="user-cell">
                    <div class="avatar">{{ u.email.slice(0, 2).toUpperCase() }}</div>
                    <div>
                      {{ u.email }}
                      <span v-if="u.id === me?.id" class="you-badge">это вы</span>
                    </div>
                  </div>
                </td>
                <td>
                  <select :value="u.role" :disabled="u.id === me?.id" @change="changeRole(u, $event)">
                    <option value="ADMIN">Администратор</option>
                    <option value="VIEWER">Наблюдатель</option>
                  </select>
                </td>
                <td>
                  <label class="switch">
                    <input type="checkbox" :checked="u.isActive" :disabled="u.id === me?.id" @change="toggleActive(u, $event)" />
                    <span class="switch-track"></span>
                  </label>
                </td>
                <td class="muted">{{ new Date(u.createdAt).toLocaleDateString('ru-RU') }}</td>
                <td>
                  <button class="danger ghost" :disabled="u.id === me?.id" title="Удалить" @click="remove(u)">
                    <AppIcon name="trash" :size="15" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="flex: 0 0 320px">
        <h2>Новый пользователь</h2>
        <form class="form" @submit.prevent="create">
          <label class="field">
            <span>Email</span>
            <input v-model="newEmail" type="email" required placeholder="user@example.com" />
          </label>
          <label class="field">
            <span>Пароль</span>
            <input v-model="newPassword" type="password" required minlength="8" placeholder="Минимум 8 символов" />
          </label>
          <label class="field">
            <span>Роль</span>
            <select v-model="newRole">
              <option value="VIEWER">Наблюдатель — только просмотр</option>
              <option value="ADMIN">Администратор — полный доступ</option>
            </select>
          </label>
          <p v-if="createError" class="error">{{ createError }}</p>
          <button class="primary" type="submit">
            <AppIcon name="plus" :size="15" /> Создать
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type UserRow = { id: string; email: string; role: 'ADMIN' | 'VIEWER'; isActive: boolean; createdAt: string };

const { api } = useApi();
const { user: me } = useAuth();

const users = ref<UserRow[]>([]);
const error = ref('');

const newEmail = ref('');
const newPassword = ref('');
const newRole = ref<'ADMIN' | 'VIEWER'>('VIEWER');
const createError = ref('');

async function load() {
  try {
    const res = await api<{ users: UserRow[] }>('/api/users');
    users.value = res.users;
  } catch (err: any) {
    error.value = err.message;
  }
}

async function changeRole(u: UserRow, event: Event) {
  const role = (event.target as HTMLSelectElement).value;
  try {
    await api(`/api/users/${u.id}`, { method: 'PATCH', body: { role } });
    await load();
  } catch (err: any) {
    error.value = err.message;
    await load();
  }
}

async function toggleActive(u: UserRow, event: Event) {
  const isActive = (event.target as HTMLInputElement).checked;
  try {
    await api(`/api/users/${u.id}`, { method: 'PATCH', body: { isActive } });
    await load();
  } catch (err: any) {
    error.value = err.message;
    await load();
  }
}

async function remove(u: UserRow) {
  if (!confirm(`Удалить пользователя ${u.email}?`)) return;
  try {
    await api(`/api/users/${u.id}`, { method: 'DELETE' });
    await load();
  } catch (err: any) {
    error.value = err.message;
  }
}

async function create() {
  createError.value = '';
  try {
    await api('/api/users', { method: 'POST', body: { email: newEmail.value, password: newPassword.value, role: newRole.value } });
    newEmail.value = '';
    newPassword.value = '';
    newRole.value = 'VIEWER';
    await load();
  } catch (err: any) {
    createError.value = err.message;
  }
}

onMounted(load);
</script>

<style scoped>
h1 {
  margin-top: 0;
}
.layout {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--surface-sunken);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.you-badge {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--surface-sunken);
  padding: 1px 7px;
  border-radius: 100px;
}
select {
  width: auto;
}
</style>
