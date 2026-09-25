import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { SECTIONS, type SectionId } from './model';

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(null, '', `#${id}`);
}

function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>('basic');
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((x): x is HTMLElement => Boolean(x));
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) visible.set(en.target.id, en.isIntersecting ? en.boundingClientRect.top : Infinity);
        const best = [...visible.entries()].filter(([, top]) => top !== Infinity).sort((a, b) => a[1] - b[1])[0];
        if (best) setActive(best[0] as SectionId);
      },
      { rootMargin: '-96px 0px -55% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

/** Sticky section rail with completion checkmarks (desktop) and a scrollable chip bar (mobile). */
export function SectionNav({ completion, errorSections }: { completion: Record<SectionId, boolean>; errorSections: Set<SectionId> }) {
  const active = useActiveSection();
  const done = SECTIONS.filter((s) => completion[s.id]).length;
  return (
    <>
      <nav aria-label="Form sections" className="sticky top-24 hidden self-start lg:block">
        <div className="mb-3 px-3">
          <div className="eyebrow">Progress</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-ink-950 transition-all" style={{ width: `${(done / SECTIONS.length) * 100}%` }} />
            </div>
            <span className="text-xs font-medium tabular text-zinc-600">
              {done}/{SECTIONS.length}
            </span>
          </div>
        </div>
        <ol className="space-y-0.5">
          {SECTIONS.map((s, i) => {
            const isActive = active === s.id;
            const hasError = errorSections.has(s.id);
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(s.id);
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors',
                    isActive ? 'bg-white text-zinc-950 shadow-card ring-1 ring-zinc-200/80' : 'text-zinc-500 hover:bg-white/60 hover:text-zinc-900',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular',
                      hasError ? 'bg-red-600 text-white' : completion[s.id] ? 'bg-volt text-ink-950' : isActive ? 'bg-ink-950 text-white' : 'bg-zinc-200 text-zinc-500',
                    )}
                    aria-hidden
                  >
                    {hasError ? '!' : completion[s.id] ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="flex-1">{s.label}</span>
                  <span className="sr-only">{hasError ? '(has errors)' : completion[s.id] ? '(complete)' : '(incomplete)'}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      <nav aria-label="Form sections" className="-mx-4 mb-4 overflow-x-auto px-4 scrollbar-thin lg:hidden">
        <ol className="flex min-w-max gap-1.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(s.id);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                  errorSections.has(s.id) ? 'border-red-200 bg-red-50 text-red-700' : active === s.id ? 'border-ink-950 bg-ink-950 text-white' : 'border-zinc-200 bg-white text-zinc-600',
                )}
              >
                {completion[s.id] && !errorSections.has(s.id) && <Check size={12} strokeWidth={3} aria-label="complete" />}
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
