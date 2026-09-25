import { useRef, useState, type ReactNode } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  /** Max size per file in MB. */
  maxSizeMb?: number;
  title?: ReactNode;
  hint?: ReactNode;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  onReject?: (message: string) => void;
}

/** Drag-and-drop + click-to-browse file picker with type/size validation. */
export function FileDropzone({ onFiles, accept = 'image/*', multiple = true, maxSizeMb = 5, title = 'Drop images here or click to upload', hint, compact, disabled, className, onReject }: FileDropzoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list);
    const accepted: File[] = [];
    for (const f of files) {
      const typeOk = accept === '*' || accept.split(',').some((a) => (a.trim().endsWith('/*') ? f.type.startsWith(a.trim().slice(0, -1)) : f.type === a.trim() || f.name.toLowerCase().endsWith(a.trim())));
      if (!typeOk) {
        onReject?.(`${f.name} is not a supported file type.`);
        continue;
      }
      if (f.size > maxSizeMb * 1024 * 1024) {
        onReject?.(`${f.name} is larger than ${maxSizeMb} MB.`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length) onFiles(multiple ? accepted : accepted.slice(0, 1));
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={cn(
        'group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors',
        compact ? 'gap-1 px-3 py-4' : 'gap-2 px-6 py-8',
        over ? 'border-ink-950 bg-volt/10' : 'border-zinc-300 bg-zinc-50/60 hover:border-zinc-400 hover:bg-zinc-50',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span className={cn('flex items-center justify-center rounded-full bg-white shadow-card ring-1 ring-zinc-200 transition-transform group-hover:-translate-y-0.5', compact ? 'h-8 w-8' : 'h-10 w-10')}>
        <UploadCloud size={compact ? 16 : 19} className="text-zinc-600" aria-hidden />
      </span>
      <span className={cn('font-medium text-zinc-800', compact ? 'text-xs' : 'text-sm')}>{title}</span>
      <span className="text-xs text-zinc-500">{hint ?? `PNG, JPG or WEBP · up to ${maxSizeMb} MB`}</span>
      <input ref={input} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => {
        handle(e.target.files);
        e.target.value = '';
      }} />
    </div>
  );
}
