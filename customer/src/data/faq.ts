import { tDynamic } from '@/i18n';
import type { FaqGroup } from '@/types';

/**
 * Customer FAQ: group ids and how many questions each has. The text lives in the
 * `pages.faq.groups.<id>.q<n>` / `a<n>` translations. Operational details (timings,
 * fees, windows) must be confirmed by the business before launch.
 */
const GROUPS: { id: string; count: number }[] = [
  { id: 'orders', count: 3 },
  { id: 'teamKits', count: 3 },
  { id: 'shipping', count: 4 },
  { id: 'returns', count: 3 },
  { id: 'payments', count: 3 },
  { id: 'sizing', count: 3 },
  { id: 'availability', count: 2 },
  { id: 'account', count: 2 },
  { id: 'wishlist', count: 2 },
];

/** FAQ groups in the current language. Call at render time. */
export function getFaqGroups(): FaqGroup[] {
  return GROUPS.map(({ id, count }) => {
    const base = `pages.faq.groups.${id}`;
    return {
      id,
      title: tDynamic(`${base}.title`, id),
      items: Array.from({ length: count }, (_, i) => ({
        question: tDynamic(`${base}.q${i + 1}`, ''),
        answer: tDynamic(`${base}.a${i + 1}`, ''),
      })),
    };
  });
}
