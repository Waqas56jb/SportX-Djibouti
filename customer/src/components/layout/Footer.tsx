import { Facebook, Instagram, MapPin, Phone, Twitter, Youtube } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LanguageSwitcher, Logo } from '@/components/common';
import { NewsletterForm } from '@/components/marketing/NewsletterForm';
import { SITE } from '@/constants/site';
import { getFooterNav } from '@/data/navigation';
import { useT } from '@/i18n';

const SOCIAL_ICONS = { Instagram, Facebook, YouTube: Youtube, X: Twitter } as const;

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h2 className="mb-5 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-white">{title}</h2>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={`${title}-${l.href}`}>
            <Link to={l.href} className="text-sm text-white/60 transition-colors hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const { t } = useT();
  const nav = useMemo(getFooterNav, []);
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-white" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        {t('layout.footer.heading')}
      </h2>

      <div className="container-site grid grid-cols-1 gap-12 border-b border-white/10 py-14 lg:grid-cols-[1.2fr_2fr] lg:gap-16 lg:py-20">
        <div className="max-w-sm">
          <Logo variant="full" size="lg" />
          <p className="mt-6 font-display text-2xl font-bold uppercase tracking-wide text-white">{t('common.site.tagline')}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">{t('common.site.description')}</p>
          <div className="mt-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]">{t('layout.footer.joinMovement')}</p>
            <NewsletterForm tone="dark" compact />
          </div>
          <div className="mt-6">
            <LanguageSwitcher variant="inline" surface="dark" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <FooterColumn title={t('layout.footer.shop')} links={nav.shop} />
          <FooterColumn title={t('layout.footer.customer')} links={nav.customer} />
          <FooterColumn title={t('layout.footer.company')} links={nav.company} />
          <div>
            <h2 className="mb-5 font-sans text-xs font-semibold uppercase tracking-[0.16em] text-white">{t('layout.footer.contact')}</h2>
            <address className="space-y-4 text-sm not-italic text-white/60">
              <p className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span>{t('common.site.addressLine')}</span>
              </p>
              <a href={SITE.contact.phoneHref} className="flex gap-3 transition-colors hover:text-white">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span className="ltr-text">{SITE.contact.phone}</span>
              </a>
            </address>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label={t('layout.footer.social')}>
              {SITE.social.map((s) => {
                const Icon = SOCIAL_ICONS[s.name as keyof typeof SOCIAL_ICONS];
                return (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      aria-label={t('layout.footer.socialOn', { brand: SITE.name, network: s.name })}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white hover:bg-white hover:text-ink"
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="overflow-hidden border-b border-white/10" aria-hidden>
        <p className="select-none whitespace-nowrap py-6 text-center font-display text-[15vw] font-extrabold italic uppercase leading-[0.8] tracking-[-0.04em] text-white/[0.04] lg:text-[13vw]">
          {t('common.site.tagline')}
        </p>
      </div>

      <div className="container-site flex flex-col gap-4 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
        <p>{t('layout.footer.rights', { year, name: SITE.name })}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link to="/privacy" className="hover:text-white">
            {t('layout.footer.privacy')}
          </Link>
          <Link to="/terms" className="hover:text-white">
            {t('layout.footer.terms')}
          </Link>
          <Link to="/shipping" className="hover:text-white">
            {t('layout.footer.shipping')}
          </Link>
          <Link to="/returns" className="hover:text-white">
            {t('layout.footer.returns')}
          </Link>
          <span>{t('layout.footer.pricesIn')}</span>
        </div>
      </div>
    </footer>
  );
}
