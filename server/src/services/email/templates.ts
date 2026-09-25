import type { EmailMessage } from './email.provider.js';

type Vars = Record<string, string | number | undefined | null>;

export type EmailTemplate =
  | 'welcome'
  | 'email_verification'
  | 'password_reset'
  | 'order_confirmation'
  | 'payment_confirmation'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'refund_processed'
  | 'support_reply';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, paragraphs: string[], cta?: { label: string; href: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0b0d10;padding:20px 28px;color:#fff;font-size:22px;font-weight:800;font-style:italic">SPORT<span style="color:#c8f54a">X</span></td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:14px;line-height:1.6;margin:0 0 12px">${p}</p>`).join('')}
${cta ? `<p style="margin:24px 0"><a href="${esc(cta.href)}" style="background:#0b0d10;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 28px;background:#fafafa;font-size:11px;color:#777">SPORTX · PLACE MENELIK, RUE DE RAS MAKONNEN, DJIBOUTI · +253 21 25 26 19</td></tr>
</table></td></tr></table></body></html>`;
}

/** Builds subject/html/text for a template. All interpolated values are HTML-escaped. */
export function render(template: EmailTemplate, v: Vars): Omit<EmailMessage, 'to'> {
  const hi = `Hi ${esc(v.firstName) || 'there'},`;
  const build = (subject: string, title: string, lines: string[], cta?: { label: string; href: string }) => ({
    subject,
    html: layout(title, [hi, ...lines], cta),
    text: [hi.replace(/&#39;/g, "'"), ...lines.map((l) => l.replace(/<[^>]+>/g, '')), cta ? `${cta.label}: ${cta.href}` : ''].filter(Boolean).join('\n\n'),
  });
  switch (template) {
    case 'welcome':
      return build('Welcome to SPORTX', 'Welcome to SPORTX', ['Your account is ready. MOVE. TRAIN. PERFORM.']);
    case 'email_verification':
      return build('Verify your email address', 'Confirm your email', ['Please confirm your email address to activate your SPORTX account.'], { label: 'Verify email', href: String(v.link) });
    case 'password_reset':
      return build('Reset your SPORTX password', 'Reset your password', [`Use the button below to choose a new password. The link expires in ${esc(v.minutes ?? 30)} minutes. If you did not ask for this, you can ignore this email.`], { label: 'Reset password', href: String(v.link) });
    case 'order_confirmation':
      return build(`Order ${esc(v.orderNumber)} received`, 'Thank you for your order', [`We have received order <strong>${esc(v.orderNumber)}</strong> for a total of <strong>${esc(v.total)}</strong>.`, 'We will let you know as soon as it ships.'], v.link ? { label: 'Track your order', href: String(v.link) } : undefined);
    case 'payment_confirmation':
      return build(`Payment confirmed for ${esc(v.orderNumber)}`, 'Payment confirmed', [`Your payment of <strong>${esc(v.total)}</strong> for order ${esc(v.orderNumber)} was successful.`], v.link ? { label: 'View order', href: String(v.link) } : undefined);
    case 'order_shipped':
      return build(`Order ${esc(v.orderNumber)} has shipped`, 'Your order is on its way', [`Order ${esc(v.orderNumber)} has left our store.${v.trackingNumber ? ` Tracking number: <strong>${esc(v.trackingNumber)}</strong>.` : ''}`], v.link ? { label: 'Track your order', href: String(v.link) } : undefined);
    case 'order_delivered':
      return build(`Order ${esc(v.orderNumber)} delivered`, 'Delivered', [`Order ${esc(v.orderNumber)} has been delivered. We hope you enjoy your gear — tell us what you think with a review.`], v.link ? { label: 'Review your purchase', href: String(v.link) } : undefined);
    case 'order_cancelled':
      return build(`Order ${esc(v.orderNumber)} cancelled`, 'Order cancelled', [`Order ${esc(v.orderNumber)} has been cancelled.${v.reason ? ` Reason: ${esc(v.reason)}.` : ''} Any payment taken will be refunded.`]);
    case 'refund_processed':
      return build(`Refund for ${esc(v.orderNumber)}`, 'Refund processed', [`A refund of <strong>${esc(v.amount)}</strong> for order ${esc(v.orderNumber)} has been processed.`]);
    case 'support_reply':
      return build(`New reply on ${esc(v.ticketNumber)}`, 'Support replied to your request', [`Our team replied to <strong>${esc(v.subject)}</strong>.`], v.link ? { label: 'View conversation', href: String(v.link) } : undefined);
  }
}
