import { useEffect } from 'react';
import { PageHeader, PageSkeleton } from '@/components/common';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { EditProfileForm } from '@/components/profile/EditProfileForm';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { NotificationPreferencesPanel } from '@/components/profile/NotificationPreferencesPanel';
import { PermissionsSummary, SessionsPanel } from '@/components/profile/SessionAndPermissions';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';

export default function ProfilePage() {
  const session = useAuthStore((s) => s.session);
  const updateSession = useAuthStore((s) => s.updateSession);
  const userId = session?.user.id;

  // Refresh the profile from GET /users/me so the page never shows stale session data.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    profileService
      .me()
      .then((me) => {
        const cur = useAuthStore.getState().session;
        if (!alive || !cur || cur.user.id !== me.id) return;
        const { name, email, phone, avatarUrl, lastLoginAt, createdAt } = me;
        updateSession({ user: { ...cur.user, name, email, phone, avatarUrl, lastLoginAt, createdAt } });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [userId, updateSession]);

  if (!session) return <PageSkeleton />;

  return (
    <div>
      <PageHeader title="My profile" documentTitle="Profile" description="Manage your personal details, password and access." />
      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5 lg:sticky lg:top-20">
          <ProfileCard session={session} />
          <PermissionsSummary session={session} />
        </div>
        <div className="min-w-0 space-y-5">
          <EditProfileForm user={session.user} />
          <ChangePasswordForm />
          <NotificationPreferencesPanel />
          <SessionsPanel session={session} />
        </div>
      </div>
    </div>
  );
}
