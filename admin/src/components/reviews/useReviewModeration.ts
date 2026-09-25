import { useState } from 'react';
import type { ReviewStatus } from '@/types';
import { reviewService } from '@/services/reviewService';
import { useNotificationStore } from '@/store/notificationStore';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';

const VERB: Record<ReviewStatus, string> = { approved: 'approved', rejected: 'rejected', hidden: 'hidden', pending: 'moved back to pending' };

const plural = (n: number) => (n === 1 ? 'Review' : `${n} reviews`);

/**
 * Moderation actions with toasts, confirmation for deletes and sidebar badge refresh.
 * Each action resolves to `true` when the change was applied.
 */
export function useReviewModeration() {
  const refreshCounts = useNotificationStore((s) => s.refreshCounts);
  const [busy, setBusy] = useState(false);

  const setStatus = async (ids: string[], status: ReviewStatus): Promise<boolean> => {
    if (!ids.length) return false;
    setBusy(true);
    try {
      if (ids.length === 1) await reviewService.updateReviewStatus(ids[0], status);
      else await reviewService.bulkUpdateStatus(ids, status);
      toast.success(`${plural(ids.length)} ${VERB[status]}.`, {
        description: status === 'approved' ? 'Now visible on the storefront.' : status === 'hidden' ? 'Removed from the storefront. You can approve it again later.' : undefined,
      });
      void refreshCounts();
      return true;
    } catch (e) {
      toast.error('Could not update review', { description: e instanceof Error ? e.message : undefined });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ids: string[]): Promise<boolean> => {
    if (!ids.length) return false;
    const ok = await confirm({
      title: ids.length === 1 ? 'Delete review?' : `Delete ${ids.length} reviews?`,
      description: 'Deleted reviews are removed permanently and can’t be restored. Consider hiding instead.',
      confirmLabel: ids.length === 1 ? 'Delete Review' : 'Delete Reviews',
      tone: 'danger',
    });
    if (!ok) return false;
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => reviewService.deleteReview(id)));
      toast.success(`${plural(ids.length)} deleted.`);
      void refreshCounts();
      return true;
    } catch (e) {
      toast.error('Could not delete review', { description: e instanceof Error ? e.message : undefined });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { setStatus, remove, busy };
}
