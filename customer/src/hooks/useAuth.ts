import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);

  return {
    user: session?.user ?? null,
    isAuthenticated: Boolean(session),
    login,
    register,
    logout,
    setUser,
  };
}
