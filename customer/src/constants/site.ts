/**
 * Brand and business information. Only facts confirmed by the business are
 * listed here — do not add addresses, emails or hours until they are provided.
 */
export const SITE = {
  name: 'SPORTX',
  tagline: 'MOVE. TRAIN. PERFORM.',
  description:
    'Premium sportswear, footwear and equipment for football, basketball, running and training. Built for athletes who demand more.',
  logo: '/logo.png',
  url: (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:5173',
  announcement: 'FREE DELIVERY ON SELECTED ORDERS | SHOP SPORTX',
  contact: {
    addressLines: ['PLACE MENELIK', 'RUE DE RAS MAKONNEN', 'DJIBOUTI'],
    phone: '+253 21 25 26 19',
    phoneHref: 'tel:+25321252619',
  },
  /** Social profile URLs — replace with the official handles when available. */
  social: [
    { name: 'Instagram', href: '#' },
    { name: 'Facebook', href: '#' },
    { name: 'YouTube', href: '#' },
    { name: 'X', href: '#' },
  ],
} as const;
