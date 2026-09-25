import { Plus } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface AccordionItemProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  titleClassName?: string;
  /** Controlled mode. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
}

/** Disclosure with smooth height animation via CSS grid rows. */
export function AccordionItem({ title, children, defaultOpen = false, className, titleClassName, open: controlled, onToggle }: AccordionItemProps) {
  const [internal, setInternal] = useState(defaultOpen);
  const open = controlled ?? internal;
  const id = useId();

  const toggle = () => {
    const next = !open;
    if (controlled === undefined) setInternal(next);
    onToggle?.(next);
  };

  return (
    <div className={cn('border-b border-paper-200', className)}>
      <h3 className="m-0 font-sans normal-case">
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={toggle}
          className={cn('flex w-full items-center justify-between gap-6 py-5 text-start text-[15px] font-semibold text-ink transition-colors hover:text-ink-600', titleClassName)}
        >
          <span>{title}</span>
          <Plus className={cn('h-4 w-4 shrink-0 transition-transform duration-300 ease-premium', open && 'rotate-45')} aria-hidden />
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-trigger`}
        className={cn('grid transition-[grid-template-rows] duration-300 ease-premium', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="overflow-hidden" {...(!open ? { inert: '' } : {})}>
          <div className="pb-6 text-[15px] leading-relaxed text-ink-600">{children}</div>
        </div>
      </div>
    </div>
  );
}
