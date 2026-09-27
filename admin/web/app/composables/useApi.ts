export function useApi() {
  const config = useRuntimeConfig();

  async function api<T>(path: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    try {
      return await $fetch<T>(path, {
        baseURL: config.public.apiBase,
        credentials: 'include',
        ...options,
      });
    } catch (err: any) {
      const message = err?.data?.error || err?.message || 'Ошибка запроса';
      throw new Error(message);
    }
  }

  return { api };
}
