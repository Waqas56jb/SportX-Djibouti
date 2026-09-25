import { useState, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Maximize2, Star, Trash2, MousePointer2 } from 'lucide-react';
import type { ProductImage } from '@/types';
import { cn } from '@/utils/cn';

const iconBtn = 'flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-zinc-700 shadow-sm ring-1 ring-zinc-200 hover:bg-white hover:text-zinc-950 disabled:opacity-30';

/** Gallery tile with HTML5 drag-and-drop plus keyboard-accessible move buttons. */
export function MediaTile({
  image,
  index,
  count,
  onMove,
  onDropAt,
  onSetRole,
  onPreview,
  onRemove,
}: {
  image: ProductImage;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onDropAt: (fromId: string) => void;
  onSetRole: (role: 'main' | 'hover') => void;
  onPreview: () => void;
  onRemove: () => void;
}) {
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const from = e.dataTransfer.getData('text/x-sportx-image');
    if (from && from !== image.id) onDropAt(from);
  };
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-sportx-image', image.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/x-sportx-image')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn('group relative overflow-hidden rounded-xl border bg-zinc-50 transition-all', over ? 'border-ink-950 ring-2 ring-volt' : 'border-zinc-200')}
    >
      <button type="button" onClick={onPreview} className="block aspect-square w-full" aria-label={`Preview ${image.alt || 'image'}`}>
        <img src={image.url} alt={image.alt} className="h-full w-full object-cover" draggable={false} />
      </button>
      <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-ink-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular">
        <GripVertical size={11} aria-hidden /> {index + 1}
      </span>
      <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button type="button" className={iconBtn} onClick={onPreview} aria-label="Open preview" title="Preview">
          <Maximize2 size={13} aria-hidden />
        </button>
        <button type="button" className={cn(iconBtn, 'hover:text-red-600')} onClick={onRemove} aria-label="Delete image" title="Delete">
          <Trash2 size={13} aria-hidden />
        </button>
      </div>
      <div className="flex items-center justify-between gap-1 border-t border-zinc-200 bg-white p-1.5">
        <div className="flex gap-1">
          <button type="button" className={iconBtn} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move image ${index + 1} left`} title="Move left">
            <ChevronLeft size={14} aria-hidden />
          </button>
          <button type="button" className={iconBtn} disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move image ${index + 1} right`} title="Move right">
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
        <div className="flex gap-1">
          <button type="button" className={iconBtn} onClick={() => onSetRole('main')} aria-label="Set as main image" title="Set as main">
            <Star size={13} aria-hidden />
          </button>
          <button type="button" className={iconBtn} onClick={() => onSetRole('hover')} aria-label="Set as hover image" title="Set as hover">
            <MousePointer2 size={13} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}
