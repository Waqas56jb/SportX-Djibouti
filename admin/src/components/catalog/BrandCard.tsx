import { Link } from 'react-router-dom';
import { ArrowUpRight, Package, Pencil, Trash2 } from 'lucide-react';
import type { Brand } from '@/types';
import { Menu, StatusBadge } from '@/components/common';
import { Toggle } from '@/components/forms';
import { ENABLED_STATUS } from '@/constants/status';
import { cn } from '@/utils/cn';
import { BrandLogo } from './BrandLogo';

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export function BrandCard({ brand: b, canEdit, canDelete, onEdit, onDelete, onToggle }: { brand: Brand; canEdit: boolean; canDelete: boolean; onEdit: () => void; onDelete: () => void; onToggle: (on: boolean) => void }) {
  return (
    <li className={cn('panel group flex flex-col transition-shadow hover:shadow-pop', b.status === 'inactive' && 'bg-zinc-50/60')}>
      <div className="flex items-start gap-4 p-5">
        <BrandLogo name={b.name} src={b.logoUrl} size={56} className={cn(b.status === 'inactive' && 'opacity-50')} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[0.9375rem] font-semibold text-zinc-950">
              {canEdit ? (
                <button type="button" onClick={onEdit} className="text-left hover:underline">
                  {b.name}
                </button>
              ) : (
                b.name
              )}
            </h3>
            <StatusBadge map={ENABLED_STATUS} value={b.status} />
          </div>
          {b.website ? (
            <a href={b.website} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-zinc-500 hover:text-zinc-900">
              {host(b.website)} <ArrowUpRight size={12} aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <span className="mt-0.5 block text-xs text-zinc-400">No website</span>
          )}
        </div>
        <Menu
          label={`Actions for ${b.name}`}
          items={[
            { label: 'Edit', icon: Pencil, onSelect: onEdit, hidden: !canEdit },
            { label: 'Delete', icon: Trash2, danger: true, separator: true, onSelect: onDelete, hidden: !canDelete },
          ]}
        />
      </div>
      <p className="line-clamp-2 min-h-[2.5rem] px-5 text-[0.8125rem] leading-relaxed text-zinc-600">{b.description || <span className="text-zinc-400">No description.</span>}</p>
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 px-5 py-3">
        <Link to={`/products?brand=${b.id}`} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-zinc-700 hover:text-zinc-950">
          <Package size={14} className="text-zinc-400" aria-hidden />
          <span className="tabular font-semibold text-zinc-950">{b.productCount}</span> {b.productCount === 1 ? 'product' : 'products'}
        </Link>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <span className="sr-only">Enable {b.name}</span>
          <span aria-hidden>{b.status === 'active' ? 'Enabled' : 'Disabled'}</span>
          <Toggle size="sm" checked={b.status === 'active'} disabled={!canEdit} onChange={onToggle} />
        </label>
      </div>
    </li>
  );
}
