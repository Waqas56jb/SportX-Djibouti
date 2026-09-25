import { useState } from 'react';
import { X } from 'lucide-react';
import { Field } from '@/components/forms';
import { cn } from '@/utils/cn';

/** Free-text chips: Enter or comma adds, Backspace on empty removes the last chip. */
export function TagInput({ label, value, onChange, placeholder = 'Type and press Enter', help, max = 20, suggestions = [] }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; help?: string; max?: number; suggestions?: string[] }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.includes(p) && next.length < max) next.push(p);
    onChange(next);
    setText('');
  };
  const open = suggestions.filter((s) => !value.includes(s)).slice(0, 6);
  return (
    <Field label={label} help={help} aside={<span className="tabular">{value.length}/{max}</span>}>
      {({ id, describedBy }) => (
        <div>
          <div className={cn('flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 shadow-sm focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10')}>
            {value.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 py-0.5 pl-2 pr-1 text-xs font-medium text-zinc-800">
                {t}
                <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700">
                  <X size={11} aria-hidden />
                </button>
              </span>
            ))}
            <input
              id={id}
              aria-describedby={describedBy}
              value={text}
              placeholder={value.length ? '' : placeholder}
              onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setText(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (text.trim()) add(text);
                } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
              }}
              onBlur={() => text.trim() && add(text)}
              className="h-6 min-w-[120px] flex-1 bg-transparent px-1 text-sm placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
          {open.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-zinc-500">Suggestions:</span>
              {open.map((s) => (
                <button key={s} type="button" onClick={() => add(s)} className="rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900">
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
