import { Award, ShieldCheck, Truck, Zap } from 'lucide-react';
import { Reveal } from '@/components/common';
import { NewsletterForm } from './NewsletterForm';
import { SmartImage } from '@/components/common';
import { IMG } from '@/data/images';

const BENEFITS = [
  { icon: Award, title: 'Quality Gear', text: 'Premium materials and performance construction, tested for the demands of real training and competition.' },
  { icon: Zap, title: 'Athlete Focused', text: 'Every product is selected for how athletes actually move — built to help you train harder and recover faster.' },
  { icon: ShieldCheck, title: 'Secure Checkout', text: 'Protected payments and a smooth, transparent checkout with no surprises at the end.' },
  { icon: Truck, title: 'Fast Delivery', text: 'Quick dispatch across Djibouti, with store pickup available at Place Menelik.' },
];

export function WhySportx() {
  return (
    <section className="border-y border-paper-200 bg-white" aria-labelledby="why-title">
      <div className="container-site py-16 sm:py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Why SPORTX</p>
            <h2 id="why-title" className="heading-lg mt-3">
              Engineered for performance.
            </h2>
          </div>
        </div>
        <ul className="mt-12 grid gap-px bg-paper-200 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="bg-white">
              <Reveal delay={i * 80} className="flex h-full flex-col p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <Icon className="h-7 w-7 text-ink" strokeWidth={1.5} aria-hidden />
                  <span className="font-display text-sm font-semibold text-ink-500">0{i + 1}</span>
                </div>
                <h3 className="mt-10 font-display text-2xl font-bold uppercase">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-500">{text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function NewsletterSection() {
  return (
    <section className="relative isolate overflow-hidden bg-paper-100" aria-labelledby="newsletter-title">
      <div className="grid lg:grid-cols-2">
        <div className="relative hidden min-h-[520px] lg:block">
          <SmartImage src={IMG.runDuoSunset} alt="Two runners training at sunset" sizes="50vw" wrapperClassName="absolute inset-0" />
        </div>
        <div className="container-site flex flex-col justify-center py-16 sm:py-24 lg:max-w-none lg:px-16 xl:px-24">
          <p className="eyebrow">Newsletter</p>
          <h2 id="newsletter-title" className="heading-xl mt-4">
            Join the SPORTX
            <br />
            movement
          </h2>
          <p className="mt-5 max-w-md text-ink-600">Be first to know about new releases, limited drops and training stories from the SPORTX community.</p>
          <div className="mt-10 max-w-lg">
            <NewsletterForm />
          </div>
        </div>
      </div>
    </section>
  );
}
