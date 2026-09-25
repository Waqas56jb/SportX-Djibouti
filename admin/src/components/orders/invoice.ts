import type { Order } from '@/types';
import { BRAND } from '@/constants/brand';
import { PAYMENT_METHOD, PAYMENT_STATUS } from '@/constants/status';
import { formatDate, formatMoney } from '@/utils/format';
import { downloadFile } from '@/utils/csv';

const esc = (s: string | number | undefined | null) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/**
 * Frontend-phase invoice: a self-contained printable HTML document.
 * The backend will replace this with a PDF (`orderService.invoiceUrl`).
 */
export function buildInvoiceHtml(o: Order): string {
  const a = o.shipping.address;
  const money = (n: number) => esc(formatMoney(n));
  const rows = o.items
    .map(
      (i) => `<tr>
        <td><strong>${esc(i.productName)}</strong><br><span class="muted">${esc(i.variantLabel)} · ${esc(i.sku)}</span></td>
        <td class="r">${i.quantity}</td><td class="r">${money(i.unitPrice)}</td><td class="r">${money(i.subtotal)}</td></tr>`,
    )
    .join('');
  const refunded = o.payment.refundedAmount;
  const card = o.payment.cardBrand && o.payment.cardLast4 ? ` · ${esc(o.payment.cardBrand)} •••• ${esc(o.payment.cardLast4)}` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(o.number)} · ${BRAND.name}</title>
<style>
  *{box-sizing:border-box} body{font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:#111418;margin:0;padding:40px;font-size:13px;line-height:1.5}
  .wrap{max-width:760px;margin:0 auto} .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0B0D10;padding-bottom:20px}
  .logo{font-size:30px;font-weight:800;font-style:italic;letter-spacing:.02em;margin:0} .logo span{color:#7da10f}
  .muted{color:#71717a;font-size:12px} h2{font-size:22px;margin:0 0 4px;text-align:right} .meta{text-align:right}
  .grid{display:flex;gap:40px;margin:28px 0} .grid div{flex:1} .label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#71717a;margin-bottom:6px}
  table{width:100%;border-collapse:collapse} th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#71717a;text-align:left;border-bottom:1px solid #e4e4e7;padding:8px 6px}
  td{border-bottom:1px solid #f4f4f5;padding:10px 6px;vertical-align:top} .r{text-align:right}
  .totals{margin-left:auto;width:300px;margin-top:16px} .totals td{border:0;padding:4px 6px} .totals .grand td{border-top:2px solid #0B0D10;font-size:15px;font-weight:700;padding-top:10px}
  .foot{margin-top:40px;border-top:1px solid #e4e4e7;padding-top:14px;text-align:center}
  @media print{body{padding:0}}
</style></head><body><div class="wrap">
<div class="top"><div><p class="logo">SPORT<span>X</span></p><div class="muted">${BRAND.addressLines.map(esc).join('<br>')}<br>${esc(BRAND.phone)}</div></div>
<div class="meta"><h2>INVOICE</h2><div><strong>${esc(o.number)}</strong></div><div class="muted">Date: ${esc(formatDate(o.createdAt))}</div></div></div>
<div class="grid"><div><div class="label">Bill to</div><strong>${esc(o.customerName)}</strong><br>${esc(o.customerEmail)}<br>${esc(o.customerPhone)}</div>
<div><div class="label">Ship to</div><strong>${esc(a.fullName)}</strong><br>${esc(a.line1)}${a.line2 ? `<br>${esc(a.line2)}` : ''}<br>${[a.district, a.city].filter(Boolean).map(esc).join(', ')}<br>${esc(a.country)}${a.postalCode ? ` ${esc(a.postalCode)}` : ''}</div>
<div><div class="label">Payment</div>${esc(PAYMENT_METHOD[o.payment.method])}${card}<br><span class="muted">${esc(PAYMENT_STATUS[o.payment.status].label)}</span></div></div>
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals"><tbody>
<tr><td>Subtotal</td><td class="r">${money(o.subtotal)}</td></tr>
${o.discount ? `<tr><td>Discount${o.couponCode ? ` (${esc(o.couponCode)})` : ''}</td><td class="r">−${money(o.discount)}</td></tr>` : ''}
<tr><td>Shipping</td><td class="r">${o.shippingCost ? money(o.shippingCost) : 'Free'}</td></tr>
${o.tax ? `<tr><td>Tax</td><td class="r">${money(o.tax)}</td></tr>` : ''}
<tr class="grand"><td>Total</td><td class="r">${money(o.total)}</td></tr>
${refunded ? `<tr><td>Refunded</td><td class="r">−${money(refunded)}</td></tr><tr><td><strong>Net</strong></td><td class="r"><strong>${money(o.total - refunded)}</strong></td></tr>` : ''}
</tbody></table>
<div class="foot muted">Thank you for shopping with ${BRAND.name} · ${esc(BRAND.tagline)}</div>
</div></body></html>`;
}

export function downloadInvoice(o: Order) {
  downloadFile(`sportx-invoice-${o.number}.html`, new Blob([buildInvoiceHtml(o)], { type: 'text/html;charset=utf-8' }));
}

/** Opens the invoice in a new tab and triggers the print dialog. Falls back to download if pop-ups are blocked. */
export function printInvoice(o: Order): boolean {
  const w = window.open('', '_blank');
  if (!w) {
    downloadInvoice(o);
    return false;
  }
  w.opener = null;
  w.document.open();
  w.document.write(buildInvoiceHtml(o));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
  return true;
}
