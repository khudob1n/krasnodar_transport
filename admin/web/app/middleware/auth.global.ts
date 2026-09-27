export default defineNuxtRouteMiddleware(async (to) => {
  const { user, loaded, fetchMe } = useAuth();

  if (!loaded.value) await fetchMe();

  if (to.path !== '/login' && !user.value) {
    return navigateTo('/login');
  }
  if (to.path === '/login' && user.value) {
    return navigateTo('/');
  }
  if (to.path.startsWith('/users') && user.value?.role !== 'ADMIN') {
    return navigateTo('/');
  }
});
