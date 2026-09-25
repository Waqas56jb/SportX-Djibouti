import type { ReactNode } from 'react';
import { SmartImage } from '@/components/common';
import { IMG } from '@/data/images';
import { useT } from '@/i18n';

/** Split-screen auth layout: editorial image on desktop, focused form everywhere. */
export function AuthShell({ title, subtitle, children, footer, image = IMG.playerVoltKit }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; image?: string }) {
  const { t } = useT();
  const tagline = t('common.site.tagline');
  return (
    <div className="grid min-h-[calc(100vh-100px)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <SmartImage src={image} alt="" sizes="50vw" priority wrapperClassName="absolute inset-0" className="opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
        <div className="absolute inset-x-12 bottom-12 text-white">
          <p className="font-display text-6xl font-extrabold uppercase leading-[0.86] tracking-[-0.02em]">
            {tagline.split(' ').map((w, i) => (
              <span key={`${w}-${i}`} className="block">
                {w}
              </span>
            ))}
          </p>
          <p className="mt-5 max-w-sm text-white/70">{t('auth.shell.pitch')}</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8 sm:py-16">
        <div className="w-full min-w-0 max-w-[440px] animate-fade-up">
          <h1 className="heading-xl break-words">{title}</h1>
          {subtitle && <div className="mt-3 text-ink-500">{subtitle}</div>}
          <div className="mt-10">{children}</div>
          {footer && <div className="mt-10 border-t border-paper-200 pt-8 text-sm text-ink-600">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
