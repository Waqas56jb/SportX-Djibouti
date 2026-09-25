import { useState } from 'react';
import { ImageOff, Maximize2 } from 'lucide-react';
import type { ProductImage } from '@/types';
import { ImagePreview } from '@/components/modals/Overlay';
import { orderedImages } from '../form/model';
import { cn } from '@/utils/cn';

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const list = orderedImages(images);
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const current = list[Math.min(active, list.length - 1)];

  if (!list.length)
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400">
        <ImageOff size={28} aria-hidden />
        <span className="text-[0.8125rem]">No images yet</span>
      </div>
    );

  return (
    <div>
      <button type="button" onClick={() => setPreview(active)} className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50" aria-label="Open full-size image">
        <img src={current.url} alt={current.alt || name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        <span className="absolute left-3 top-3 rounded-md bg-ink-950/80 px-2 py-0.5 text-[11px] font-semibold capitalize text-white">{current.role}</span>
        <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-zinc-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          <Maximize2 size={15} aria-hidden />
        </span>
      </button>
      {list.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="Product images">
          {list.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === active || undefined}
                className={cn('block aspect-square w-full overflow-hidden rounded-lg border-2 bg-zinc-50', i === active ? 'border-ink-950' : 'border-transparent opacity-70 hover:opacity-100')}
              >
                <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ImagePreview images={list.map((i) => ({ url: i.url, alt: i.alt || name }))} index={preview} onClose={() => setPreview(null)} onIndexChange={setPreview} />
    </div>
  );
}
