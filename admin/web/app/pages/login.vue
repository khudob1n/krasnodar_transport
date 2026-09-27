<template>
  <div class="wrap">
    <form class="card" @submit.prevent="onSubmit">
      <img src="/design/logo-mark.svg" alt="" class="logo" />
      <div>
        <h1>Админка транспорта</h1>
        <p class="subtitle">Маршруты, остановки и живые позиции ТС Краснодара</p>
      </div>
      <label>
        Email
        <input v-model="email" type="email" required autocomplete="username" />
      </label>
      <label>
        Пароль
        <input v-model="password" type="password" required autocomplete="current-password" />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="primary" type="submit" :disabled="loading">
        {{ loading ? 'Входим…' : 'Войти' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'blank' });

const { login } = useAuth();
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    await login(email.value, password.value);
    await navigateTo('/');
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ekb-sidebar);
}
.card {
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 28px;
  background: #16181d;
  border-color: #24262c;
}
.logo {
  width: 36px;
  height: auto;
}
h1 {
  font-size: 19px;
  margin: 0 0 4px;
  color: #fff;
}
.subtitle {
  margin: 0;
  font-size: 13px;
  color: #8a91a0;
  line-height: 1.4;
}
label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  color: #b8bfcc;
}
input {
  background: #0c0d10;
  border-color: #2a2f3a;
  color: #fff;
}
button.primary {
  width: 100%;
  padding: 10px;
  margin-top: 4px;
}
</style>
