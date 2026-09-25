import { useState } from 'react';
import { ArrowDownToLine, Info, Loader2, Maximize2, Trash2 } from 'lucide-react';
import type { ProductImage } from '@/types';
import { productService } from '@/services';
import { FileDropzone, FormSection } from '@/components/forms';
import { ImagePreview } from '@/components/modals/Overlay';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';
import { orderedImages } from './model';
import { MediaTile } from './MediaTile';

type Role = ProductImage['role'];

export function MediaSection({ images, update, error, productName }: { images: ProductImage[]; update: (fn: (prev: ProductImage[]) => ProductImage[]) => void; error?: string; productName: string }) {
  const onChange = (next: ProductImage[]) => update(() => next);
  const [uploading, setUploading] = useState<Record<Role, number>>({ main: 0, hover: 0, gallery: 0 });
  const [preview, setPreview] = useState<number | null>(null);

  const ordered = orderedImages(images);
  const main = ordered.find((i) => i.role === 'main');
  const hover = ordered.find((i) => i.role === 'hover');
  const gallery = ordered.filter((i) => i.role === 'gallery');

  /** Assigns a role; the previous holder of main/hover goes back to the gallery. */
  const assign = (list: ProductImage[], id: string, role: Role) =>
    list.map((img) => (img.id === id ? { ...img, role } : role !== 'gallery' && img.role === role ? { ...img, role: 'gallery' as const } : img));

  const upload = async (files: File[], role: Role) => {
    const batch = role === 'gallery' ? files : files.slice(0, 1);
    setUploading((u) => ({ ...u, [role]: u[role] + batch.length }));
    try {
      const uploaded = await Promise.all(batch.map((f) => productService.uploadImage(f, role)));
      const named = uploaded.map((img) => ({ ...img, alt: productName ? `${productName} — ${img.alt}` : img.alt }));
      update((prev) => {
        let next = [...prev, ...named.map((i) => ({ ...i, role: 'gallery' as const }))];
        if (role !== 'gallery' && named[0]) next = assign(next, named[0].id, role);
        // First image uploaded anywhere becomes the main image.
        if (!next.some((i) => i.role === 'main') && next[0]) next = assign(next, next[0].id, 'main');
        return next;
      });
    } catch (e) {
      toast.error('Could not add image.', { description: e instanceof Error ? e.message : 'Please try again.' });
    } finally {
      setUploading((u) => ({ ...u, [role]: u[role] - batch.length }));
    }
  };

  const remove = (id: string) => onChange(images.filter((i) => i.id !== id));

  const moveGallery = (fromId: string, toIndex: number) => {
    const g = gallery.filter((i) => i.id !== fromId);
    const moving = images.find((i) => i.id === fromId);
    if (!moving) return;
    g.splice(Math.max(0, Math.min(toIndex, g.length)), 0, { ...moving, role: 'gallery' });
    onChange([...images.filter((i) => i.role !== 'gallery' && i.id !== fromId), ...g]);
  };

  const previewList = ordered.map((i) => ({ url: i.url, alt: i.alt || productName || 'Product image' }));
  const openPreview = (id: string) => setPreview(ordered.findIndex((i) => i.id === id));

  return (
    <FormSection id="media" title="Media" description="Main and hover images drive the storefront card. Drag gallery images to reorder.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slot
          label="Main image"
          hint="Shown on listings and as the first gallery image."
          image={main}
          busy={uploading.main > 0}
          error={error}
          onUpload={(f) => void upload(f, 'main')}
          onDropImage={(id) => onChange(assign(images, id, 'main'))}
          onPreview={() => main && openPreview(main.id)}
          onDemote={() => main && onChange(assign(images, main.id, 'gallery'))}
          onRemove={() => main && remove(main.id)}
        />
        <Slot
          label="Hover image"
          hint="Revealed when shoppers hover the product card."
          image={hover}
          busy={uploading.hover > 0}
          onUpload={(f) => void upload(f, 'hover')}
          onDropImage={(id) => onChange(assign(images, id, 'hover'))}
          onPreview={() => hover && openPreview(hover.id)}
          onDemote={() => hover && onChange(assign(images, hover.id, 'gallery'))}
          onRemove={() => hover && remove(hover.id)}
        />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[0.8125rem] font-medium text-zinc-800">
            Gallery <span className="font-normal text-zinc-400">· {gallery.length} images</span>
          </h3>
          {gallery.length > 1 && <span className="hidden text-xs text-zinc-500 sm:inline">Drag tiles or use the arrows to reorder</span>}
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="Gallery images">
          {gallery.map((img, i) => (
            <MediaTile
              key={img.id}
              image={img}
              index={i}
              count={gallery.length}
              onMove={(dir) => moveGallery(img.id, i + dir)}
              onDropAt={(fromId) => moveGallery(fromId, i)}
              onSetRole={(role) => onChange(assign(images, img.id, role))}
              onPreview={() => openPreview(img.id)}
              onRemove={() => remove(img.id)}
            />
          ))}
          {Array.from({ length: uploading.gallery }).map((_, i) => (
            <li key={`up${i}`} className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50">
              <Loader2 size={20} className="animate-spin text-zinc-400" aria-label="Uploading" />
            </li>
          ))}
          <li className={cn(gallery.length + uploading.gallery === 0 && 'col-span-full')}>
            <FileDropzone
              compact={gallery.length > 0}
              className="h-full min-h-[140px]"
              title={gallery.length ? 'Add images' : 'Drop gallery images here or click to upload'}
              onFiles={(f) => void upload(f, 'gallery')}
              onReject={(m) => toast.error(m)}
            />
          </li>
        </ul>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
        <Info size={14} className="mt-px shrink-0" aria-hidden />
        New images upload when you save the product (JPEG, PNG, WebP or AVIF). Publishing requires a main image.
      </p>

      <ImagePreview images={previewList} index={preview} onClose={() => setPreview(null)} onIndexChange={setPreview} />
    </FormSection>
  );
}

function Slot({
  label,
  hint,
  image,
  busy,
  error,
  onUpload,
  onDropImage,
  onPreview,
  onDemote,
  onRemove,
}: {
  label: string;
  hint: string;
  image?: ProductImage;
  busy: boolean;
  error?: string;
  onUpload: (files: File[]) => void;
  onDropImage: (id: string) => void;
  onPreview: () => void;
  onDemote: () => void;
  onRemove: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/x-sportx-image')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData('text/x-sportx-image');
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onDropImage(id);
      }}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[0.8125rem] font-medium text-zinc-800">{label}</span>
        <span className="truncate text-xs text-zinc-400">{hint}</span>
      </div>
      {busy ? (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50">
          <Loader2 size={22} className="animate-spin text-zinc-400" aria-label="Uploading" />
        </div>
      ) : image ? (
        <div className={cn('group relative aspect-[4/3] overflow-hidden rounded-xl border bg-zinc-50', over ? 'border-ink-950 ring-2 ring-volt' : 'border-zinc-200')}>
          <img src={image.url} alt={image.alt} className="h-full w-full object-cover" />
          <span className="absolute left-2.5 top-2.5 rounded-md bg-volt px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-950">{label.split(' ')[0]}</span>
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-ink-950/70 to-transparent p-2.5 pt-8">
            <SlotBtn icon={Maximize2} label="Preview" onClick={onPreview} />
            <SlotBtn icon={ArrowDownToLine} label="Move to gallery" onClick={onDemote} />
            <SlotBtn icon={Trash2} label="Delete" onClick={onRemove} />
          </div>
        </div>
      ) : (
        <FileDropzone
          multiple={false}
          className={cn('aspect-[4/3]', over && 'border-ink-950 bg-volt/10', error && 'border-red-300 bg-red-50/40')}
          title={`Upload ${label.toLowerCase()}`}
          hint="Or drag a gallery image here"
          onFiles={onUpload}
          onReject={(m) => toast.error(m)}
        />
      )}
      {error && !image && (
        <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SlotBtn({ icon: Icon, label, onClick }: { icon: typeof Trash2; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-zinc-700 shadow-sm hover:bg-white hover:text-zinc-950">
      <Icon size={14} aria-hidden />
    </button>
  );
}
