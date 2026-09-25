import { Check, CheckCircle2, MapPin, Navigation, Phone, Shirt } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, InlineAlert, TextAreaField, TextField } from '@/components/common';
import { PageHero } from '@/components/marketing/PageHero';
import { SITE } from '@/constants/site';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useT } from '@/i18n';
import { errorMessage, marketingService } from '@/services';
import type { ContactPayload } from '@/types';
import { EMAIL_RE, validate, type Validator } from '@/utils/validation';

const EMPTY: ContactPayload = { name: '', email: '', phone: '', message: '' };
const MESSAGE_MIN = 10;
const TEAM_POINTS = ['point1', 'point2', 'point3', 'point4'] as const;

export default function ContactPage() {
  const { t } = useT();
  const address = SITE.contact.addressLines.join(', ');
  usePageMeta({ title: t('pages.contact.metaTitle'), description: t('pages.contact.metaDescription', { address, phone: SITE.contact.phone }) });
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactPayload, string>>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const set = (k: keyof ContactPayload) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const rules: Partial<Record<keyof ContactPayload, Validator>> = {
    name: (v) => (v.trim() ? undefined : t('pages.contact.form.nameRequired')),
    email: (v) => (!v.trim() ? t('pages.contact.form.emailRequired') : EMAIL_RE.test(v.trim()) ? undefined : t('pages.contact.form.emailInvalid')),
    phone: (v) => {
      const digits = v.replace(/[^\d]/g, '');
      if (!digits) return t('pages.contact.form.phoneRequired');
      return digits.length < 8 || digits.length > 15 ? t('pages.contact.form.phoneInvalid') : undefined;
    },
    message: (v) => (v.trim().length >= MESSAGE_MIN ? undefined : t('pages.contact.form.messageMin', { min: MESSAGE_MIN })),
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(values, rules);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus('loading');
    setServerError(null);
    try {
      await marketingService.sendContactMessage(values);
      setStatus('success');
      setValues(EMPTY);
    } catch (err) {
      setServerError(errorMessage(err, t('pages.contact.form.error')));
      setStatus('error');
    }
  };

  /** Pre-fills the message with a team-kit enquiry template and moves focus to it. */
  const startTeamEnquiry = () => {
    setStatus('idle');
    setValues((v) => ({ ...v, message: v.message.trim() ? v.message : t('pages.contact.teamOrders.template') }));
    setErrors((x) => ({ ...x, message: undefined }));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => messageRef.current?.focus({ preventScroll: true }), 350);
  };

  const mapQuery = encodeURIComponent(address);

  return (
    <>
      <PageHero
        eyebrow={t('pages.contact.hero.eyebrow')}
        title={t('pages.contact.hero.title')}
        description={t('pages.contact.hero.description')}
        crumbs={[{ label: t('pages.contact.crumb') }]}
      />

      <div className="container-site grid grid-cols-1 gap-12 pb-24 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <div className="min-w-0 space-y-10">
          <div className="bg-ink p-6 text-white sm:p-10">
            <p className="font-display text-4xl font-extrabold italic tracking-tight" dir="ltr">
              SPORT<span className="text-accent">X</span>
            </p>
            <address className="mt-8 space-y-6 not-italic">
              <div className="flex gap-4">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">{t('pages.contact.store')}</p>
                  {SITE.contact.addressLines.map((l) => (
                    <p key={l} className="text-lg font-semibold leading-snug">
                      {l}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <Phone className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">{t('pages.contact.phone')}</p>
                  <a href={SITE.contact.phoneHref} className="ltr-text text-lg font-semibold hover:text-accent">
                    {SITE.contact.phone}
                  </a>
                </div>
              </div>
            </address>
          </div>

          <div className="border border-paper-200 bg-paper-50 p-6 sm:p-8">
            <p className="eyebrow flex items-center gap-2">
              <Shirt className="h-4 w-4" aria-hidden />
              {t('pages.contact.teamOrders.eyebrow')}
            </p>
            <h2 className="heading-md mt-3">{t('pages.contact.teamOrders.title')}</h2>
            <p className="mt-2 text-ink-600">{t('pages.contact.teamOrders.body')}</p>
            <ul className="mt-5 space-y-2.5 text-sm text-ink-700">
              {TEAM_POINTS.map((k) => (
                <li key={k} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-dark" aria-hidden />
                  <span>{t(`pages.contact.teamOrders.${k}`)}</span>
                </li>
              ))}
            </ul>
            <Button variant="primary" className="mt-6 w-full sm:w-auto" onClick={startTeamEnquiry}>
              {t('pages.contact.teamOrders.cta')}
            </Button>
          </div>

          {/* Map placeholder — swap for a Google Maps / Mapbox embed once an API key is provided. */}
          <div className="relative aspect-[4/3] overflow-hidden border border-paper-200 bg-paper-100" role="img" aria-label={t('pages.contact.mapLabel', { address })}>
            <svg className="absolute inset-0 h-full w-full text-paper-300" aria-hidden>
              <defs>
                <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
                  <path d="M 36 0 L 0 0 0 36" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              <path d="M-20 220 C 120 180, 220 260, 420 200 S 700 140, 900 190" stroke="#fff" strokeWidth="18" fill="none" />
              <path d="M180 -20 C 200 120, 160 240, 230 420" stroke="#fff" strokeWidth="12" fill="none" />
            </svg>
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
              <span className="whitespace-nowrap bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white">SPORTX</span>
              <span className="h-3 w-px bg-ink" />
              <span className="h-3 w-3 rounded-full border-2 border-white bg-accent shadow" />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-light absolute bottom-4 end-4 shadow-card"
            >
              <Navigation className="h-4 w-4" aria-hidden /> {t('pages.contact.directions')}
            </a>
          </div>
        </div>

        <div ref={formRef} className="min-w-0 scroll-mt-24">
          <h2 className="heading-lg">{t('pages.contact.form.title')}</h2>
          <p className="mt-3 text-ink-500">{t('pages.contact.form.subtitle')}</p>
          {status === 'success' ? (
            <div className="mt-10 border border-success/20 bg-success-50 p-6 sm:p-8" role="status">
              <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
              <p className="mt-4 text-lg font-semibold">{t('pages.contact.form.successTitle')}</p>
              <p className="mt-2 text-ink-600">{t('pages.contact.form.successBody')}</p>
              <Button variant="outline" className="mt-6" onClick={() => setStatus('idle')}>
                {t('pages.contact.form.sendAnother')}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-10 grid gap-5 sm:grid-cols-2">
              {serverError && (
                <InlineAlert tone="error" className="sm:col-span-2">
                  {serverError}
                </InlineAlert>
              )}
              <TextField label={t('pages.contact.form.name')} autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} containerClassName="sm:col-span-2" />
              <TextField label={t('pages.contact.form.email')} type="email" dir="ltr" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
              <TextField label={t('pages.contact.form.phone')} type="tel" dir="ltr" autoComplete="tel" placeholder="+253" value={values.phone} onChange={set('phone')} error={errors.phone} />
              <TextAreaField
                ref={messageRef}
                label={t('pages.contact.form.message')}
                rows={7}
                value={values.message}
                onChange={set('message')}
                error={errors.message}
                containerClassName="sm:col-span-2"
                maxLength={2000}
              />
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" size="lg" loading={status === 'loading'} loadingText={t('pages.contact.form.sending')} className="w-full sm:w-auto">
                  {t('pages.contact.form.submit')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
