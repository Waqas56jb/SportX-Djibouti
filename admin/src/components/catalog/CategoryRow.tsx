import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, CornerDownRight, FolderPlus, GripVertical, Package, Pencil, Trash2 } from 'lucide-react';
import { IconButton, Menu, ProductThumb } from '@/components/common';
import { Toggle } from '@/components/forms';
import { cn } from '@/utils/cn';
import type { CategoryNode } from './categoryTree';

const DND_TYPE = 'text/x-sportx-category';

export function CategoryRow({
  node,
  childCount,
  canEdit,
  canReorder,
  canDelete,
  canCreate,
  busy,
  onEdit,
  onAddChild,
  onDelete,
  onToggle,
  onMove,
  onDropSibling,
}: {
  node: CategoryNode;
  childCount: number;
  canEdit: boolean;
  /** Reordering is disabled while the list is filtered. */
  canReorder: boolean;
  canDelete: boolean;
  canCreate: boolean;
  busy: boolean;
  onEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
  onMove: (dir: -1 | 1) => void;
  /** Called with the dragged category id when dropped on this row. */
  onDropSibling: (draggedId: string) => void;
}) {
  const c = node.category;
  const navigate = useNavigate();
  const [over, setOver] = useState(false);
  // dataTransfer types are lower-cased by browsers; the parent key restricts drops to siblings.
  const parentKey = `text/x-parent-${c.parentId ?? 'root'}`.toLowerCase();

  return (
    <li
      draggable={canReorder}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_TYPE, c.id);
        e.dataTransfer.setData(parentKey, '');
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        // Only siblings (same parent) can be dropped here.
        if (e.dataTransfer.types.includes(DND_TYPE) && e.dataTransfer.types.includes(parentKey)) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData(DND_TYPE);
        if (id && id !== c.id) onDropSibling(id);
      }}
      className={cn('group flex items-center gap-3 border-b border-zinc-100 py-2.5 pr-3 transition-colors last:border-0', over ? 'bg-volt/10 shadow-[inset_0_2px_0_#0B0D10]' : 'hover:bg-zinc-50/70', c.status === 'inactive' && 'bg-zinc-50/40')}
      style={{ paddingLeft: 12 + node.depth * 28 }}
    >
      {canReorder && <GripVertical size={16} className="shrink-0 cursor-grab text-zinc-300 group-hover:text-zinc-500" aria-hidden />}
      {node.depth > 0 && <CornerDownRight size={15} className="-ml-1 shrink-0 text-zinc-300" aria-hidden />}
      <ProductThumb src={c.imageUrl} alt="" size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onEdit} disabled={!canEdit} className={cn('truncate text-left text-sm font-medium', c.status === 'inactive' ? 'text-zinc-500' : 'text-zinc-900', canEdit && 'hover:underline')}>
            {c.name}
          </button>
          {childCount > 0 && <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-500">{childCount} sub</span>}
          {c.status === 'inactive' && <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Hidden</span>}
        </div>
        <div className="truncate font-mono text-xs text-zinc-400">/{c.slug}</div>
      </div>

      <Link to={`/products?category=${c.id}`} className="hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[0.8125rem] font-medium tabular text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 sm:inline-flex" title="View products in this category">
        <Package size={14} className="text-zinc-400" aria-hidden /> {c.productCount}
        <span className="sr-only">products</span>
      </Link>

      {canReorder && (
        <div className="hidden shrink-0 items-center sm:flex">
          <IconButton icon={ArrowUp} size="sm" label={`Move ${c.name} up`} disabled={busy || node.index === 0} onClick={() => onMove(-1)} />
          <IconButton icon={ArrowDown} size="sm" label={`Move ${c.name} down`} disabled={busy || node.index === node.siblingIds.length - 1} onClick={() => onMove(1)} />
        </div>
      )}
      <label className="flex shrink-0 items-center" title={c.status === 'active' ? 'Enabled' : 'Disabled'}>
        <span className="sr-only">Enable {c.name}</span>
        <Toggle size="sm" checked={c.status === 'active'} disabled={!canEdit || busy} onChange={onToggle} />
      </label>
      <Menu
        label={`Actions for ${c.name}`}
        items={[
          { label: 'Edit', icon: Pencil, onSelect: onEdit, hidden: !canEdit },
          { label: 'Add subcategory', icon: FolderPlus, onSelect: onAddChild, hidden: !canCreate || node.depth > 0 },
          { label: 'Move up', icon: ArrowUp, onSelect: () => onMove(-1), hidden: !canReorder, disabled: node.index === 0 },
          { label: 'Move down', icon: ArrowDown, onSelect: () => onMove(1), hidden: !canReorder, disabled: node.index === node.siblingIds.length - 1 },
          { label: 'View products', icon: Package, onSelect: () => navigate(`/products?category=${c.id}`) },
          { label: 'Delete', icon: Trash2, danger: true, separator: true, onSelect: onDelete, hidden: !canDelete },
        ]}
      />
    </li>
  );
}
