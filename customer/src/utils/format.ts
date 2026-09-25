import { CURRENCY } from '@/constants/commerce';
import { currentLocale, t } from '@/i18n';

/** Formatting follows the selected storefront language (Arabic keeps Latin digits). */
export const formatPrice = (amount: number) =>
  new Intl.NumberFormat(currentLocale(), {
    style: 'currency',
    currency: CURRENCY.code,
    currencyDisplay: 'code',
    minimumFractionDigits: CURRENCY.fractionDigits,
    maximumFractionDigits: CURRENCY.fractionDigits,
  }).format(amount);

export const formatNumber = (value: number) => new Intl.NumberFormat(currentLocale()).format(value);

export const formatDate = (iso: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat(currentLocale(), options).format(new Date(iso));

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86400000;
  if (diff < 3600000) return t('common.time.justNow');
  if (diff < day) return t('common.time.hoursAgo', { count: Math.floor(diff / 3600000) });
  if (diff < 7 * day) return t('common.time.daysAgo', { count: Math.floor(diff / day) });
  return formatDate(iso);
};

/** English-only helper kept for non-UI text; UI copy should use plural keys via `t(key, { count })`. */
export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export const initials = (first: string, last: string) => `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
