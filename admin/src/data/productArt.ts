import type { ProductType } from '@/types';

/**
 * Generates a clean studio-style product illustration as an SVG data URI.
 * Used as demo imagery so the admin never shows broken images before real
 * product photography is uploaded to storage.
 */
const SHAPES: Record<ProductType, string> = {
  footwear:
    '<path d="M28 132c14-2 30-14 44-30l10-14c4-5 11-5 14 1l6 12c6 10 20 18 36 22l26 6c10 2 14 10 12 18l-2 6H30c-6 0-9-4-8-9z"/><path d="M26 146h136v8H30c-3 0-4-2-4-4z" opacity=".55"/>',
  apparel:
    '<path d="M74 44l18-8c3 8 13 12 18 12s15-4 18-12l18 8 30 26-16 22-14-10v86H74V82l-14 10-16-22z"/>',
  jersey:
    '<path d="M74 44l18-8c3 8 13 12 18 12s15-4 18-12l18 8 30 26-16 22-14-10v86H74V82l-14 10-16-22z"/><path d="M96 80h28v4H96zM98 96h24v34H98z" fill="#fff" opacity=".35"/>',
  shorts: '<path d="M58 60h104l10 92h-44l-18-52-18 52H48z"/><path d="M58 60h104v12H58z" opacity=".55"/>',
  tracksuit:
    '<path d="M76 34l16-6c3 7 12 10 18 10s15-3 18-10l16 6 26 22-14 18-12-8v48H76V66l-12 8-14-18z"/><path d="M76 120h68l6 56h-28l-12-36-12 36H70z" opacity=".8"/>',
  bag: '<rect x="42" y="78" width="136" height="80" rx="16"/><path d="M82 78v-12c0-8 6-14 14-14h28c8 0 14 6 14 14v12h-10v-10c0-3-2-6-6-6h-24c-4 0-6 3-6 6v10z"/><path d="M42 108h136v6H42z" fill="#fff" opacity=".25"/>',
  socks: '<path d="M88 34h40v86c0 4 2 8 6 10l24 14c10 6 12 18 4 26-6 6-14 6-20 2l-44-26c-6-4-10-10-10-18z"/><path d="M88 34h40v14H88z" opacity=".55"/>',
  gloves:
    '<path d="M70 176v-42l-16-26c-4-8 4-14 10-8l12 14V60c0-6 8-6 8 0v44h4V48c0-6 8-6 8 0v56h4V52c0-6 8-6 8 0v52h4V64c0-6 8-6 8 0v68c0 16-6 28-14 44z"/>',
  ball: '<circle cx="110" cy="108" r="64"/><path d="M110 78l24 17-9 28H95l-9-28z" fill="#fff" opacity=".35"/><path d="M110 44v34M134 95l32-8M125 123l18 28M95 123l-18 28M86 95l-32-8" stroke="#fff" stroke-width="3" opacity=".3" fill="none"/>',
  equipment:
    '<rect x="30" y="80" width="22" height="56" rx="4"/><rect x="52" y="90" width="14" height="36" rx="3"/><rect x="66" y="102" width="88" height="12" rx="3"/><rect x="154" y="90" width="14" height="36" rx="3"/><rect x="168" y="80" width="22" height="56" rx="4"/>',
};

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function productArt(type: ProductType, colorHex: string, opts: { variant?: 'main' | 'hover' | 'detail'; label?: string } = {}): string {
  const light = luminance(colorHex) > 0.82;
  const fill = light ? '#E3E4E6' : colorHex;
  const stroke = light ? '#B9BBBF' : 'none';
  const bg = opts.variant === 'hover' ? '#ECEDEF' : opts.variant === 'detail' ? '#E9EAE4' : '#F3F4F6';
  const transform = opts.variant === 'hover' ? 'translate(220 0) scale(-1 1)' : opts.variant === 'detail' ? 'translate(-30 -26) scale(1.28)' : '';
  const label = opts.label ? `<text x="16" y="206" font-family="Arial, sans-serif" font-size="9" font-weight="700" letter-spacing="1.6" fill="#9CA3AF">${opts.label.toUpperCase().replace(/[<&>]/g, '')}</text>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220"><rect width="220" height="220" fill="${bg}"/><ellipse cx="110" cy="182" rx="70" ry="6" fill="#000" opacity=".06"/><g fill="${fill}" stroke="${stroke}" stroke-width="1.5" transform="${transform}">${SHAPES[type]}</g>${label}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
