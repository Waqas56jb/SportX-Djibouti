/** Google-style search result preview. */
export function SearchPreview({ title, description, slug }: { title: string; description: string; slug: string }) {
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4" aria-label="Search engine preview">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-950 font-display text-sm font-extrabold italic text-volt" aria-hidden>
          X
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[0.8125rem] text-zinc-800">SPORTX Djibouti</div>
          <div className="truncate text-xs text-zinc-500">https://sportx.dj › products › {slug || 'product-slug'}</div>
        </div>
      </div>
      <div className="mt-2 text-lg leading-snug text-[#1a0dab]">{clip(title || 'Product title', 60)}</div>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-zinc-600">{clip(description || 'Add a meta description to control how this product appears in search results.', 160)}</p>
    </div>
  );
}
