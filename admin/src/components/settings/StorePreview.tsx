import { useState } from 'react';
import { Clock, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import type { StoreSettings } from '@/types';
import { Wordmark } from '@/components/common/Misc';
import { FileDropzone } from '@/components/forms/FileUpload';
import { toast } from '@/store/toastStore';

/**
 * Logo picker. The file is uploaded immediately (POST /admin/settings/logo) — logos are not part of
 * the unsaved-changes form. The API has no "remove logo" endpoint, so a logo can only be replaced.
 */
export function StoreLogoField({ value, onUpload, disabled }: { value?: string; onUpload: (file: File) => Promise<void>; disabled?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => {
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div>
      <p className="mb-1.5 text-[0.8125rem] font-medium text-zinc-800">Logo</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="relative flex h-[132px] w-full shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-ink-950 p-4 sm:w-[200px]" aria-busy={uploading}>
          {value ? <img src={value} alt="Store logo" className="max-h-full max-w-full object-contain" /> : <Wordmark />}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-ink-950/70 text-white">
              <Loader2 size={20} className="animate-spin" aria-label="Uploading logo" />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <FileDropzone
            compact
            multiple={false}
            accept="image/png,image/jpeg,image/webp,image/avif"
            maxSizeMb={5}
            disabled={disabled || uploading}
            title={uploading ? 'Uploading…' : value ? 'Replace logo' : 'Upload logo'}
            hint="PNG, JPG, WEBP or AVIF · up to 5 MB · uploaded and published immediately"
            onReject={(m) => toast.error('Logo not accepted', { description: m })}
            onFiles={([file]) => file && void upload(file)}
            className="flex-1"
          />
          {!value && <p className="text-xs text-zinc-500">No logo uploaded — the SPORTX wordmark is used across the admin and storefront.</p>}
        </div>
      </div>
    </div>
  );
}

/** Live preview of the contact card customers see in the storefront footer and on the contact page. */
export function StoreContactPreview({ s }: { s: Pick<StoreSettings, 'storeName' | 'logoUrl' | 'tagline' | 'email' | 'phone' | 'addressLine1' | 'addressLine2' | 'city' | 'country' | 'currency' | 'timezone'> }) {
  const address = [s.addressLine1, s.addressLine2, [s.city, s.country && s.country.toUpperCase() !== s.city.toUpperCase() ? s.country : ''].filter(Boolean).join(', ')].filter((l) => l.trim());
  return (
    <aside aria-label="Storefront contact card preview" className="lg:sticky lg:top-24">
      <p className="eyebrow mb-2">Live preview · Storefront contact card</p>
      <div className="overflow-hidden rounded-2xl bg-ink-950 text-white shadow-pop">
        <div className="relative px-6 pb-5 pt-6">
          <span className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-volt/15 blur-2xl" aria-hidden />
          {s.logoUrl ? <img src={s.logoUrl} alt={s.storeName || 'Store logo'} className="h-10 w-auto max-w-[180px] object-contain" /> : <Wordmark showTagline={false} />}
          <p className="mt-3 text-2xs font-semibold uppercase tracking-[0.28em] text-volt">{s.tagline || 'Your tagline'}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{s.storeName || 'Store name'}</p>
        </div>
        <ul className="space-y-3 border-t border-white/10 px-6 py-5 text-[0.8125rem]">
          <li className="flex gap-3">
            <MapPin size={16} className="mt-0.5 shrink-0 text-zinc-500" aria-hidden />
            <span className="leading-relaxed text-zinc-200">{address.length ? address.map((l, i) => <span key={i} className="block">{l}</span>) : <span className="text-zinc-500">Address not set</span>}</span>
          </li>
          <li className="flex gap-3">
            <Phone size={16} className="mt-0.5 shrink-0 text-zinc-500" aria-hidden />
            {s.phone ? <span className="tabular text-zinc-200">{s.phone}</span> : <span className="text-zinc-500">Phone not set</span>}
          </li>
          <li className="flex gap-3">
            <Mail size={16} className="mt-0.5 shrink-0 text-zinc-500" aria-hidden />
            {s.email ? <span className="break-all text-zinc-200">{s.email}</span> : <span className="text-zinc-500">Email not set — hidden on the storefront</span>}
          </li>
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.03] px-6 py-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Clock size={13} aria-hidden /> {s.timezone}
          </span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-semibold text-zinc-200">{s.currency}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-500">Updates as you type. Only saved values are published to the storefront.</p>
    </aside>
  );
}
