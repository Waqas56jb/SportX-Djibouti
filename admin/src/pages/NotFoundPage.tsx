import { Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { Button } from '@/components/common/Button';
import { useDocumentTitle } from '@/hooks/misc';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="font-display text-[7rem] font-extrabold italic leading-none tracking-tight text-zinc-200">
        4<span className="text-volt-600">0</span>4
      </div>
      <h1 className="mt-2 text-xl font-semibold text-zinc-950">This page is out of bounds</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">The page you’re looking for doesn’t exist or has moved. Check the address, or search for what you need.</p>
      <div className="mt-6 flex gap-2">
        <Button icon={Search} onClick={() => setCommandOpen(true)}>
          Search
        </Button>
        <Link to="/dashboard" className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink-950 px-3.5 text-sm font-medium text-white hover:bg-ink-800">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
