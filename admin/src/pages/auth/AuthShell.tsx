import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Wordmark } from '@/components/common/Misc';
import { BRAND } from '@/constants/brand';

/** Split-screen frame shared by the sign-in, forgot-password and reset-password screens. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-ink-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 top-1/3 h-[520px] w-[520px] rotate-12 rounded-[96px] border border-white/[0.06]" />
          <div className="absolute -right-8 top-[42%] h-[380px] w-[380px] rotate-12 rounded-[72px] border border-white/[0.05]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-volt/40 to-transparent" />
          <div className="absolute inset-y-0 left-[58%] w-24 -skew-x-12 bg-volt/[0.035]" />
        </div>
        <div className="relative flex items-center gap-3">
          <Wordmark />
          <span className="mb-3 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-300">Admin</span>
        </div>
        <div className="relative">
          <p className="eyebrow !text-volt">Operations platform</p>
          <h1 className="mt-4 font-display text-[4.25rem] font-extrabold uppercase italic leading-[0.9] tracking-tight text-white xl:text-[5rem]">
            Move.
            <br />
            Train.
            <br />
            <span className="text-volt">Perform.</span>
          </h1>
          <p className="mt-6 max-w-md text-[0.9375rem] leading-relaxed text-zinc-400">Catalogue, inventory, orders, customers and marketing for the SPORTX store — in one control centre.</p>
        </div>
        <div className="relative flex items-end justify-between gap-6 text-xs text-zinc-500">
          <address className="not-italic leading-relaxed">
            {BRAND.addressLines.map((l) => (
              <div key={l}>{l}</div>
            ))}
            <div className="mt-1 text-zinc-400">{BRAND.phone}</div>
          </address>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-volt" aria-hidden /> Authorised staff only
          </span>
        </div>
      </aside>

      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <div className="inline-flex rounded-xl bg-ink-950 px-4 py-3">
              <Wordmark />
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthAlert({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-amber-200 bg-amber-50 text-amber-800';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`mt-6 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[0.8125rem] ${cls}`}>
      {children}
    </div>
  );
}
