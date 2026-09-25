import { Check, ChevronDown, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, languageInfo, useT, type Lang } from '@/i18n';
import { cn } from '@/utils/cn';

interface LanguageSwitcherProps {
  /** `menu`: compact globe button with a dropdown (header). `inline`: segmented buttons (mobile menu, footer). */
  variant?: 'menu' | 'inline';
  /** Colour scheme of the surrounding surface. */
  surface?: 'dark' | 'light';
  className?: string;
}

/** Lets shoppers switch between English, Français and العربية. The choice is remembered on this device. */
export function LanguageSwitcher({ variant = 'menu', surface = 'dark', className }: LanguageSwitcherProps) {
  const { t, lang, setLang } = useT();
  const dark = surface === 'dark';

  if (variant === 'inline') {
    return (
      <div role="group" aria-label={t('common.language.label')} className={cn('inline-flex rounded-full border p-1', dark ? 'border-white/20' : 'border-paper-300', className)}>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            onClick={() => setLang(l.code)}
            aria-pressed={lang === l.code}
            className={cn(
              'min-h-[36px] rounded-full px-3.5 text-[13px] font-semibold transition-colors',
              lang === l.code ? (dark ? 'bg-white text-ink' : 'bg-ink text-white') : dark ? 'text-white/70 hover:text-white' : 'text-ink-600 hover:text-ink',
            )}
          >
            {l.label}
          </button>
        ))}
      </div>
    );
  }

  return <LanguageMenu lang={lang} setLang={setLang} dark={dark} className={className} />;
}

function LanguageMenu({ lang, setLang, dark, className }: { lang: Lang; setLang: (l: Lang) => void; dark: boolean; className?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = languageInfo(lang);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('common.language.change')} (${current.label})`}
        className={cn(
          'flex h-11 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold uppercase transition-colors',
          dark ? 'text-white hover:bg-white/10' : 'text-ink hover:bg-paper-200',
        )}
      >
        <Globe className="h-[19px] w-[19px]" aria-hidden />
        <span>{current.short}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <ul role="listbox" aria-label={t('common.language.label')} className="absolute end-0 top-full z-50 mt-2 w-44 animate-scale-in overflow-hidden rounded-sm border border-paper-200 bg-white py-1 text-ink shadow-lift">
          {LANGUAGES.map((l) => (
            <li key={l.code} role="option" aria-selected={lang === l.code}>
              <button
                type="button"
                lang={l.code}
                onClick={() => {
                  setOpen(false);
                  if (l.code !== lang) setLang(l.code);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-sm hover:bg-paper-100"
              >
                <span className={cn(lang === l.code && 'font-semibold')}>{l.label}</span>
                {lang === l.code && <Check className="h-4 w-4 text-accent-dark" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
