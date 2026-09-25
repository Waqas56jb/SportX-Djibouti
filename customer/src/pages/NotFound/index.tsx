import { ArrowRight } from 'lucide-react';
import { ButtonLink, SmartImage } from '@/components/common';
import { IMG } from '@/data/images';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function NotFoundPage({ title = 'Looks like you’ve left the playing field.', message }: { title?: string; message?: string }) {
  usePageMeta({ title: 'Page not found', noindex: true });
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white">
      <SmartImage src={IMG.fbLine} alt="" wrapperClassName="absolute inset-0 -z-10" className="opacity-35" priority />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/80 to-ink/30" aria-hidden />
      <div className="container-site flex min-h-[70vh] flex-col justify-center py-20">
        <p className="font-display text-[7rem] font-extrabold leading-none tracking-tight text-white/10 sm:text-[11rem]" aria-hidden>
          404
        </p>
        <h1 className="-mt-6 max-w-3xl font-display text-4xl font-extrabold uppercase leading-[0.92] text-white sm:-mt-10 sm:text-display-md lg:text-display-lg">{title}</h1>
        <p className="mt-5 max-w-md text-white/70">{message ?? 'The page you’re looking for has moved, been retired or never existed. Let’s get you back in the game.'}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink to="/shop" variant="accent" size="lg" rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
            Back to shop
          </ButtonLink>
          <ButtonLink to="/" variant="outline-light" size="lg">
            Home
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
