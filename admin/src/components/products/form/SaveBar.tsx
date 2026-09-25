import { forwardRef } from 'react';
import { AlertCircle, Save, Send } from 'lucide-react';
import { Button } from '@/components/common';
import { cn } from '@/utils/cn';
import { SECTIONS, sectionOfError, type FormErrors } from './model';
import { scrollToSection } from './SectionNav';

export type SaveIntent = 'draft' | 'publish' | 'save';

/** Sticky bottom action bar for the product form. */
export function SaveBar({
  mode,
  dirty,
  saving,
  errorCount,
  isPublished,
  onCancel,
  onSave,
}: {
  mode: 'create' | 'edit';
  dirty: boolean;
  saving: SaveIntent | null;
  errorCount: number;
  isPublished: boolean;
  onCancel: () => void;
  onSave: (intent: SaveIntent) => void;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-zinc-200/80 bg-white/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto flex min-w-0 items-center gap-2 text-[0.8125rem]" aria-live="polite">
          {errorCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
              <AlertCircle size={15} aria-hidden /> {errorCount} {errorCount === 1 ? 'issue' : 'issues'} to fix
            </span>
          ) : dirty ? (
            <span className="inline-flex items-center gap-2 font-medium text-zinc-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden /> Unsaved changes
            </span>
          ) : (
            <span className="hidden text-zinc-500 sm:inline">{mode === 'edit' ? 'All changes saved' : 'New product'}</span>
          )}
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={Boolean(saving)}>
          Cancel
        </Button>
        {mode === 'create' ? (
          <Button icon={Save} loading={saving === 'draft'} disabled={Boolean(saving)} onClick={() => onSave('draft')}>
            Save as draft
          </Button>
        ) : (
          <Button icon={Save} variant={isPublished ? 'primary' : 'secondary'} loading={saving === 'save'} disabled={Boolean(saving)} onClick={() => onSave('save')}>
            Save changes
          </Button>
        )}
        {(mode === 'create' || !isPublished) && (
          <Button variant="primary" icon={Send} loading={saving === 'publish'} disabled={Boolean(saving)} onClick={() => onSave('publish')}>
            Publish
          </Button>
        )}
      </div>
    </div>
  );
}

/** Error summary shown above the form after a failed save. Focusable so screen readers announce it. */
export const ErrorSummary = forwardRef<HTMLDivElement, { errors: FormErrors; className?: string }>(function ErrorSummary({ errors, className }, ref) {
  const keys = Object.keys(errors);
  if (!keys.length) return null;
  const bySection = SECTIONS.map((s) => ({ ...s, messages: keys.filter((k) => sectionOfError(k) === s.id).map((k) => errors[k]) })).filter((s) => s.messages.length);
  return (
    <div ref={ref} tabIndex={-1} role="alert" className={cn('rounded-xl border border-red-200 bg-red-50/70 p-4 focus:outline-none', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
        <AlertCircle size={16} aria-hidden /> Please fix {keys.length} {keys.length === 1 ? 'issue' : 'issues'} before saving
      </div>
      <ul className="mt-2 space-y-1 text-[0.8125rem] text-red-800">
        {bySection.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => scrollToSection(s.id)} className="font-semibold underline-offset-2 hover:underline">
              {s.label}
            </button>
            <span className="text-red-700">: {[...new Set(s.messages)].slice(0, 3).join(' ')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
