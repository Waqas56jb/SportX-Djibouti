import { Award, ShieldCheck, Shirt, Truck } from 'lucide-react';
import { Reveal, SmartImage } from '@/components/common';
import { IMG } from '@/data/images';
import { useT } from '@/i18n';
import { NewsletterForm } from './NewsletterForm';

const BENEFITS = [
  { icon: Award, title: 'b1', text: 'b1Text' },
  { icon: Shirt, title: 'b2', text: 'b2Text' },
  { icon: ShieldCheck, title: 'b3', text: 'b3Text' },
  { icon: Truck, title: 'b4', text: 'b4Text' },
] as const;

export function WhySportx() {
  const { t } = useT();
  return (
    <section className="border-y border-paper-200 bg-white" aria-labelledby="why-title">
      <div className="container-site py-16 sm:py-20">
        <p className="eyebrow">{t('home.why.eyebrow')}</p>
        <h2 id="why-title" className="heading-lg mt-3">
          {t('home.why.title')}
        </h2>
        <ul className="mt-12 grid gap-px bg-paper-200 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="bg-white">
              <Reveal delay={i * 80} className="flex h-full flex-col p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <Icon className="h-7 w-7 text-ink" strokeWidth={1.5} aria-hidden />
                  <span className="font-display text-sm font-semibold text-ink-500">0{i + 1}</span>
                </div>
                <h3 className="mt-10 font-display text-2xl font-bold uppercase">{t(`home.why.${title}`)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-500">{t(`home.why.${text}`)}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function NewsletterSection() {
  const { t } = useT();
  return (
    <section className="relative isolate overflow-hidden bg-paper-100" aria-labelledby="newsletter-title">
      <div className="grid lg:grid-cols-2">
        <div className="relative hidden min-h-[520px] lg:block">
          <SmartImage src={IMG.jugglingSunset} alt={t('home.newsletter.imageAlt')} sizes="50vw" wrapperClassName="absolute inset-0" />
        </div>
        <div className="container-site flex flex-col justify-center py-16 sm:py-24 lg:max-w-none lg:px-16 xl:px-24">
          <p className="eyebrow">{t('home.newsletter.eyebrow')}</p>
          <h2 id="newsletter-title" className="heading-xl mt-4">
            {t('home.newsletter.titleA')}
            <br />
            {t('home.newsletter.titleB')}
          </h2>
          <p className="mt-5 max-w-md text-ink-600">{t('home.newsletter.body')}</p>
          <div className="mt-10 max-w-lg">
            <NewsletterForm />
          </div>
        </div>
      </div>
    </section>
  );
}
