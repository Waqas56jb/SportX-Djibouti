import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { usePermission } from '@/hooks/usePermission';
import type { PermissionKey } from '@/types';
import ForbiddenPage from '@/pages/ForbiddenPage';
import { Wordmark } from '@/components/common/Misc';

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-950" role="status" aria-label="Loading SPORTX Admin">
      <Wordmark />
      <Loader2 className="animate-spin text-volt" size={20} aria-hidden />
    </div>
  );
}

/** Restores the session once, then gates admin routes behind authentication. */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const restore = useAuthStore((s) => s.restore);
  const location = useLocation();
  useEffect(() => {
    if (status === 'idle') void restore();
  }, [status, restore]);
  if (status === 'idle' || status === 'checking') return <Splash />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <Outlet />;
}

/** Redirects signed-in admins away from /login. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const restore = useAuthStore((s) => s.restore);
  useEffect(() => {
    if (status === 'idle') void restore();
  }, [status, restore]);
  if (status === 'idle' || status === 'checking') return <Splash />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Route-level permission gate. The backend must enforce the same rule on every endpoint. */
export function RequirePermission({ permission, children }: { permission?: PermissionKey | PermissionKey[]; children: ReactNode }) {
  const allowed = usePermission(permission);
  return allowed ? <>{children}</> : <ForbiddenPage />;
}
