import { FileWarning } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { PageHero } from '@/components/marketing/PageHero';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from '@/constants/commerce';
import { SITE } from '@/constants/site';
import { usePageMeta } from '@/hooks/usePageMeta';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';

type LegalKey = 'privacy' | 'terms' | 'shipping' | 'returns';

interface LegalDoc {
  title: string;
  description: string;
  sections: { heading: string; body: string[] }[];
}

const contactLine = `${SITE.name}, ${SITE.contact.addressLines.join(', ')} — ${SITE.contact.phone}`;

/**
 * DRAFT CONTENT. These documents are structural placeholders written in plain
 * language. They must be reviewed and replaced by the business’s final,
 * legally approved policies before launch.
 */
const DOCS: Record<LegalKey, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    description: 'How SPORTX collects, uses and protects your personal information.',
    sections: [
      { heading: 'Information we collect', body: ['When you create an account, place an order or contact us, we collect details such as your name, email address, phone number and delivery address.', 'We also collect information about how you use our website, such as pages visited and products viewed, to improve your experience.'] },
      { heading: 'How we use your information', body: ['To process and deliver your orders, provide customer support, manage your account and — where you have agreed — send you news and offers.'] },
      { heading: 'Payments', body: ['Card payments are handled by our payment partner. SPORTX does not store full card numbers.'] },
      { heading: 'Sharing your information', body: ['We share information only with service providers who help us operate the store (for example delivery and payment partners) and where required by law.'] },
      { heading: 'Your choices', body: ['You can update your details and communication preferences at any time from your account, or contact us to request access to or deletion of your data.'] },
      { heading: 'Contact', body: [contactLine] },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    description: 'The terms that apply when you shop with SPORTX.',
    sections: [
      { heading: 'About these terms', body: ['These terms apply to all purchases made on the SPORTX website. By placing an order, you agree to them.'] },
      { heading: 'Products and pricing', body: ['Prices are shown in Djiboutian francs (DJF). We make every effort to display accurate product information and pricing; if an error is found we will contact you before processing your order.'] },
      { heading: 'Orders', body: ['An order is confirmed once you receive an order confirmation. We may decline or cancel an order if a product is unavailable or if payment cannot be verified.'] },
      { heading: 'Accounts', body: ['You are responsible for keeping your account credentials secure and for activity under your account.'] },
      { heading: 'Liability', body: ['Nothing in these terms limits rights you have under applicable consumer law.'] },
      { heading: 'Contact', body: [contactLine] },
    ],
  },
  shipping: {
    title: 'Shipping Policy',
    description: 'Delivery options, timings and costs.',
    sections: [
      { heading: 'Where we deliver', body: ['We currently deliver within Djibouti. Additional regions may be added in future.'] },
      {
        heading: 'Delivery options',
        body: SHIPPING_METHODS.map(
          (m) => `${m.name}: ${m.description} ${m.price === 0 ? 'Free.' : `${formatPrice(m.price)}.`} Estimated ${m.eta[0] === m.eta[1] ? `${m.eta[0]} business day` : `${m.eta[0]}–${m.eta[1]} business days`}.`,
        ),
      },
      { heading: 'Free delivery', body: [`Delivery is free on selected orders, currently orders over ${formatPrice(FREE_SHIPPING_THRESHOLD)} after discounts.`] },
      { heading: 'Tracking', body: ['Signed-in customers can follow every order stage from Account → Orders.'] },
    ],
  },
  returns: {
    title: 'Returns & Exchanges',
    description: 'How to return or exchange an item.',
    sections: [
      { heading: 'Eligibility', body: ['Items must be unworn, unwashed and returned in their original condition and packaging with proof of purchase.', 'For hygiene reasons, some items such as socks may not be eligible for return unless faulty.'] },
      { heading: 'How to return or exchange', body: ['Open a support ticket from your account with your order number, or visit our store at Place Menelik with your receipt.'] },
      { heading: 'Refunds', body: ['Approved refunds are issued to the original payment method. Cash on delivery orders are refunded by an agreed method.'] },
      { heading: 'Faulty items', body: ['If an item arrives damaged or faulty, contact us as soon as possible and we will make it right.'] },
    ],
  },
};

const NAV: { key: LegalKey; label: string }[] = [
  { key: 'privacy', label: 'Privacy' },
  { key: 'terms', label: 'Terms' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'returns', label: 'Returns' },
];

export default function LegalPage({ doc }: { doc: LegalKey }) {
  const content = DOCS[doc];
  usePageMeta({ title: content.title, description: content.description });

  return (
    <>
      <PageHero eyebrow="Policies" title={content.title} description={content.description} crumbs={[{ label: content.title }]} />
      <div className="container-site grid gap-10 pb-24 lg:grid-cols-[220px_1fr] lg:gap-16">
        <nav aria-label="Policies" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="scrollbar-none flex gap-2 overflow-x-auto lg:flex-col lg:gap-0.5">
            {NAV.map((n) => (
              <li key={n.key} className="shrink-0">
                <NavLink
                  to={`/${n.key}`}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-[40px] items-center border px-4 text-sm transition-colors lg:border-0 lg:border-l-2',
                      isActive ? 'border-ink font-semibold text-ink' : 'border-paper-300 text-ink-500 hover:text-ink lg:border-transparent',
                    )
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <article className="max-w-prose">
          <div className="mb-10 flex gap-3 border border-warning/20 bg-warning-50 p-4 text-sm text-warning" role="note">
            <FileWarning className="h-5 w-5 shrink-0" aria-hidden />
            <p>
              <strong className="font-semibold">Draft policy.</strong> This page is placeholder content and will be replaced with SPORTX’s final, approved policy before launch.
            </p>
          </div>
          <ol className="space-y-10">
            {content.sections.map((s, i) => (
              <li key={s.heading}>
                <h2 className="font-display text-2xl font-bold uppercase">
                  <span className="mr-3 text-accent-dark">{String(i + 1).padStart(2, '0')}</span>
                  {s.heading}
                </h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-600">
                  {s.body.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </>
  );
}
