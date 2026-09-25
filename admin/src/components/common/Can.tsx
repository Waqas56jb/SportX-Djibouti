import type { ReactNode } from 'react';
import type { PermissionKey } from '@/types';
import { usePermission } from '@/hooks/usePermission';

/** Renders children only when the signed-in admin holds the permission(s). */
export function Can({ permission, children, fallback = null }: { permission: PermissionKey | PermissionKey[]; children: ReactNode; fallback?: ReactNode }) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}
