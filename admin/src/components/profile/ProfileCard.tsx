import { useRef, useState } from 'react';
import { Camera, CalendarDays, Clock, Loader2, Mail, Phone, ShieldCheck } from 'lucide-react';
import type { AuthSession } from '@/types';
import { Avatar, Badge } from '@/components/common';
import { profileService } from '@/services/profileService';
import { errorMessage } from '@/components/settings/formErrors';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { formatDate, formatRelative } from '@/utils/format';

const MAX_MB = 5;
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];

export function ProfileCard({ session }: { session: AuthSession }) {
  const { user, role } = session;
  const updateSession = useAuthStore((s) => s.updateSession);
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return toast.error('Choose an image file.', { description: 'PNG, JPG, WEBP or AVIF.' });
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Image is larger than ${MAX_MB} MB.`);
    setUploading(true);
    try {
      const saved = await profileService.uploadAvatar(file);
      updateSession({ user: { ...user, avatarUrl: saved.avatarUrl } });
      toast.success('Profile photo updated.');
    } catch (e) {
      toast.error('Couldn’t update your photo.', { description: errorMessage(e, 'Try a different image.') });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    try {
      await profileService.removeAvatar();
      updateSession({ user: { ...user, avatarUrl: undefined } });
      toast.success('Profile photo removed.');
    } catch (e) {
      toast.error('Couldn’t remove your photo.', { description: errorMessage(e) });
    } finally {
      setUploading(false);
    }
  };

  const meta = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Phone, label: 'Phone', value: user.phone || 'Not set' },
    { icon: Clock, label: 'Last sign-in', value: user.lastLoginAt ? formatRelative(user.lastLoginAt) : '—' },
    { icon: CalendarDays, label: 'Member since', value: formatDate(user.createdAt) },
  ];

  return (
    <section className="panel overflow-hidden" aria-label="Your profile">
      <div className="relative h-24 bg-ink-950">
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} aria-hidden />
        <div className="absolute -inset-y-6 right-10 w-8 skew-x-[-18deg] bg-volt" aria-hidden />
      </div>
      <div className="px-5 pb-5">
        <div className="-mt-11 flex items-end justify-between gap-3">
          <div className="relative">
            <Avatar name={user.name} src={user.avatarUrl} size={88} className="ring-4 ring-white" />
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={uploading}
              aria-label="Change profile photo"
              title="Change profile photo"
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 text-white ring-2 ring-white transition-colors hover:bg-ink-800 disabled:opacity-60"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Camera size={14} aria-hidden />}
            </button>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {user.avatarUrl && (
            <button type="button" onClick={() => void removePhoto()} disabled={uploading} className="mb-1 text-xs font-medium text-zinc-500 hover:text-red-600">
              Remove photo
            </button>
          )}
        </div>
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950">{user.name}</h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="brand" size="md" dot>
            {role.name}
          </Badge>
          {role.permissions.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <ShieldCheck size={13} aria-hidden /> {role.permissions.length} permissions
            </span>
          )}
        </div>
        <dl className="mt-5 space-y-3 border-t border-zinc-100 pt-4">
          {meta.map((m) => (
            <div key={m.label} className="flex items-center gap-3 text-[0.8125rem]">
              <m.icon size={15} className="shrink-0 text-zinc-400" aria-hidden />
              <dt className="w-24 shrink-0 text-zinc-500">{m.label}</dt>
              <dd className="min-w-0 truncate font-medium text-zinc-900" title={m.value}>
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
