import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { PermissionKey } from '@/types';
import { hasPermission } from '@/utils/permissions';

/** Reactive permission check for the signed-in admin. */
export function usePermission(key: PermissionKey | PermissionKey[] | undefined): boolean {
  const perms = useAuthStore((s) => s.session?.role.permissions);
  return hasPermission(perms, key);
}

/**
 * Returns a checker bound to the current permissions. The function identity is stable until the
 * permissions change, so it is safe in effect/memo dependency lists.
 */
export function usePermissions() {
  const perms = useAuthStore((s) => s.session?.role.permissions);
  return useCallback((key: PermissionKey | PermissionKey[] | undefined) => hasPermission(perms, key), [perms]);
}
