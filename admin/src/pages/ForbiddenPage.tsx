import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useDocumentTitle } from '@/hooks/misc';

export default function ForbiddenPage() {
  useDocumentTitle('Access restricted');
  const role = useAuthStore((s) => s.session?.role.name);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-950 text-volt">
        <Lock size={24} aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-zinc-950">You don’t have access to this area</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        Your role{role ? <> (<strong className="font-medium text-zinc-700">{role}</strong>)</> : null} doesn’t include permission for this module. Ask a Super Admin to update your role if you need access.
      </p>
      <Link to="/dashboard" className="mt-6 inline-flex h-9 items-center rounded-lg bg-ink-950 px-3.5 text-sm font-medium text-white hover:bg-ink-800">
        Go to dashboard
      </Link>
    </div>
  );
}
