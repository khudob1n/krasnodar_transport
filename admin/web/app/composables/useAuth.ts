type User = { id: string; email: string; role: 'ADMIN' | 'VIEWER' };

export function useAuth() {
  const user = useState<User | null>('auth:user', () => null);
  const loaded = useState<boolean>('auth:loaded', () => false);
  const { api } = useApi();

  async function fetchMe() {
    try {
      const res = await api<{ user: User }>('/api/auth/me');
      user.value = res.user;
    } catch {
      user.value = null;
    } finally {
      loaded.value = true;
    }
  }

  async function login(email: string, password: string) {
    const res = await api<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    user.value = res.user;
    loaded.value = true;
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    user.value = null;
  }

  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  return { user, loaded, isAdmin, fetchMe, login, logout };
}
