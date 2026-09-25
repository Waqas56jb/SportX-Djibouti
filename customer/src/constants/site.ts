/**
 * Brand and business information. Only facts confirmed by the business are
 * listed here — do not add addresses, emails or hours until they are provided.
 */
export const SITE = {
  name: 'SPORTX',
  tagline: 'MOVE. TRAIN. PERFORM.',
  description:
    'Premium football boots, team kits, jerseys, polos, socks and bags in Djibouti. Built for players, clubs and schools.',
  logo: '/brand/wolf-logo-full@2x.png',
  /** Header lockup (wolf + wordmark, no strapline) — legible at small sizes. */
  logoMark: '/brand/wolf-mark-gold@2x.png',
  url: (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:5173',
  announcement: 'FREE DELIVERY ON SELECTED ORDERS | SHOP SPORTX',
  contact: {
    addressLines: ['PLACE MENELIK', 'RUE DE RAS MAKONNEN', 'DJIBOUTI'],
    phone: '+253 21 25 26 19',
    phoneHref: 'tel:+25321252619',
  },
  /**
   * Leadership shown in the "A word from our CEO" section. Set `name` to the CEO's full name to
   * display it; the title, quote and body copy live in the `home.ceo` translations.
   */
  ceo: {
    name: '',
    portrait: '/brand/ceo-portrait.jpg',
    portraitWebp: '/brand/ceo-portrait.webp',
  },
  /** Social profile URLs — replace with the official handles when available. */
  social: [
    { name: 'Instagram', href: '#' },
    { name: 'Facebook', href: '#' },
    { name: 'YouTube', href: '#' },
    { name: 'X', href: '#' },
  ],
} as const;
