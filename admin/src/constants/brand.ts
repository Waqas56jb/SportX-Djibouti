export const BRAND = {
  name: 'SPORTX',
  tagline: 'MOVE. TRAIN. PERFORM.',
  addressLines: ['PLACE MENELIK', 'RUE DE RAS MAKONNEN', 'DJIBOUTI'],
  phone: '+253 21 25 26 19',
  country: 'Djibouti',
} as const;

/**
 * Official logo path. Set to '/logo.png' once the client logo is copied into admin/public
 * (same asset as customer/public/logo.png). While null, the typographic wordmark is used.
 */
export const LOGO_SRC: string | null = null;
