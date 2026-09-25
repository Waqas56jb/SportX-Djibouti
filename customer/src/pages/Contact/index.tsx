import { CheckCircle2, MapPin, Navigation, Phone } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, InlineAlert, TextAreaField, TextField } from '@/components/common';
import { PageHero } from '@/components/marketing/PageHero';
import { SITE } from '@/constants/site';
import { usePageMeta } from '@/hooks/usePageMeta';
import { errorMessage, marketingService } from '@/services';
import type { ContactPayload } from '@/types';
import { email, minLength, phone, required, validate } from '@/utils/validation';

const EMPTY: ContactPayload = { name: '', email: '', phone: '', message: '' };

export default function ContactPage() {
  usePageMeta({ title: 'Contact', description: `Visit SPORTX at ${SITE.contact.addressLines.join(', ')} or call ${SITE.contact.phone}.` });
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactPayload, string>>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  const set = (k: keyof ContactPayload) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(values, { name: required('Enter your name'), email, phone, message: minLength(10, 'Message') });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus('loading');
    setServerError(null);
    try {
      await marketingService.sendContactMessage(values);
      setStatus('success');
      setValues(EMPTY);
    } catch (err) {
      setServerError(errorMessage(err));
      setStatus('error');
    }
  };

  const mapQuery = encodeURIComponent(`${SITE.contact.addressLines.join(', ')}`);

  return (
    <>
      <PageHero eyebrow="Get in touch" title="Contact SPORTX" description="Questions about products, orders or team kit? Visit us, call us or send a message." crumbs={[{ label: 'Contact' }]} />

      <div className="container-site grid grid-cols-1 gap-12 pb-24 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <div className="space-y-10">
          <div className="bg-ink p-8 text-white sm:p-10">
            <p className="font-display text-4xl font-extrabold italic tracking-tight">
              SPORT<span className="text-accent">X</span>
            </p>
            <address className="mt-8 space-y-6 not-italic">
              <div className="flex gap-4">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Store</p>
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
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Phone</p>
                  <a href={SITE.contact.phoneHref} className="text-lg font-semibold hover:text-accent">
                    {SITE.contact.phone}
                  </a>
                </div>
              </div>
            </address>
          </div>

          {/* Map placeholder — swap for a Google Maps / Mapbox embed once an API key is provided. */}
          <div className="relative aspect-[4/3] overflow-hidden border border-paper-200 bg-paper-100" role="img" aria-label={`Map showing SPORTX at ${SITE.contact.addressLines.join(', ')}`}>
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
              className="btn btn-sm btn-light absolute bottom-4 right-4 shadow-card"
            >
              <Navigation className="h-4 w-4" aria-hidden /> Get directions
            </a>
          </div>
        </div>

        <div>
          <h2 className="heading-lg">Send us a message</h2>
          <p className="mt-3 text-ink-500">We’ll get back to you as soon as possible.</p>
          {status === 'success' ? (
            <div className="mt-10 border border-success/20 bg-success-50 p-8" role="status">
              <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
              <p className="mt-4 text-lg font-semibold">Message sent</p>
              <p className="mt-2 text-ink-600">Thanks for reaching out. A member of the SPORTX team will be in touch shortly.</p>
              <Button variant="outline" className="mt-6" onClick={() => setStatus('idle')}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-10 grid gap-5 sm:grid-cols-2">
              {serverError && (
                <InlineAlert tone="error" className="sm:col-span-2">
                  {serverError}
                </InlineAlert>
              )}
              <TextField label="Name" autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} containerClassName="sm:col-span-2" />
              <TextField label="Email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
              <TextField label="Phone" type="tel" autoComplete="tel" placeholder="+253" value={values.phone} onChange={set('phone')} error={errors.phone} />
              <TextAreaField label="Message" rows={7} value={values.message} onChange={set('message')} error={errors.message} containerClassName="sm:col-span-2" maxLength={2000} />
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" size="lg" loading={status === 'loading'} loadingText="Sending…" className="w-full sm:w-auto">
                  Send message
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
