import type { PermissionKey } from '@/types';

/**
 * Returns true when the granted list contains every required permission.
 * `undefined` requirement = public to any signed-in admin.
 * UI checks are for experience only — the backend must enforce the same permissions.
 */
export function hasPermission(granted: readonly PermissionKey[] | undefined, required: PermissionKey | PermissionKey[] | undefined): boolean {
  if (!required) return true;
  if (!granted) return false;
  const req = Array.isArray(required) ? required : [required];
  return req.every((r) => granted.includes(r));
}
