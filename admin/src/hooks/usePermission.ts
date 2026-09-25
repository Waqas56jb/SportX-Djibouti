import { useAuthStore } from '@/store/authStore';
import type { PermissionKey } from '@/types';
import { hasPermission } from '@/utils/permissions';

/** Reactive permission check for the signed-in admin. */
export function usePermission(key: PermissionKey | PermissionKey[] | undefined): boolean {
  const perms = useAuthStore((s) => s.session?.role.permissions);
  return hasPermission(perms, key);
}

export function usePermissions() {
  const perms = useAuthStore((s) => s.session?.role.permissions);
  return (key: PermissionKey | PermissionKey[] | undefined) => hasPermission(perms, key);
}
