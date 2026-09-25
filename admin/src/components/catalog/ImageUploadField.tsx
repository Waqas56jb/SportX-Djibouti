import type { ReactNode } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { FileDropzone } from '@/components/forms';
import { Button } from '@/components/common';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

/**
 * Single-image picker with preview. Picking a file returns a local object-URL preview plus the
 * File itself; the owner uploads the file to the API when the form is saved.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  hint,
  fallback,
  aspect = 'wide',
}: {
  label: string;
  value?: string;
  onChange: (url: string | undefined, file?: File) => void;
  hint?: ReactNode;
  /** Rendered in the preview when no image is set (e.g. a monogram). */
  fallback?: ReactNode;
  aspect?: 'wide' | 'square';
}) {
  const pick = (files: File[]) => {
    const f = files[0];
    if (f) onChange(URL.createObjectURL(f), f);
  };
  return (
    <div>
      <div className="mb-1.5 text-[0.8125rem] font-medium text-zinc-800">{label}</div>
      {value ? (
        <div className="flex items-center gap-4 rounded-xl border border-zinc-200 p-3">
          <div className={cn('shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50', aspect === 'wide' ? 'h-20 w-32' : 'h-20 w-20')}>
            <img src={value} alt={`${label} preview`} className={cn('h-full w-full', aspect === 'wide' ? 'object-cover' : 'object-contain p-2')} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-xs text-zinc-500">{value.startsWith('blob:') ? 'New image — uploaded when you save.' : 'Current image.'}</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[0.8125rem] font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 focus-within:ring-2 focus-within:ring-zinc-900">
                <RefreshCw size={14} aria-hidden /> Replace
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    pick(Array.from(e.target.files ?? []));
                    e.target.value = '';
                  }}
                />
              </label>
              <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => onChange(undefined)}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-stretch gap-3">
          {fallback && <div className="flex shrink-0 items-center">{fallback}</div>}
          <FileDropzone compact multiple={false} onFiles={pick} onReject={(m) => toast.error(m)} className="flex-1" hint={hint} />
        </div>
      )}
    </div>
  );
}
