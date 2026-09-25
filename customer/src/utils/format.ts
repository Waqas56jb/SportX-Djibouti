import { CURRENCY } from '@/constants/commerce';

const priceFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  style: 'currency',
  currency: CURRENCY.code,
  minimumFractionDigits: CURRENCY.fractionDigits,
  maximumFractionDigits: CURRENCY.fractionDigits,
});

export const formatPrice = (amount: number) => priceFormatter.format(amount);

export const formatNumber = (value: number) => new Intl.NumberFormat(CURRENCY.locale).format(value);

export const formatDate = (iso: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('en-GB', options).format(new Date(iso));

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86400000;
  if (diff < 3600000) return 'Just now';
  if (diff < day) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return formatDate(iso);
};

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export const initials = (first: string, last: string) => `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
