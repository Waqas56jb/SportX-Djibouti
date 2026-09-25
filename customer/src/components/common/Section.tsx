import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useInView } from '@/hooks/useUi';
import { cn } from '@/utils/cn';

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: { label: string; href: string };
  align?: 'left' | 'center';
  tone?: 'dark' | 'light';
  className?: string;
  as?: 'h1' | 'h2';
}

export function SectionHeading({ eyebrow, title, description, action, align = 'left', tone = 'dark', className, as: Tag = 'h2' }: SectionHeadingProps) {
  return (
    <div className={cn('flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between', align === 'center' && 'items-center text-center sm:flex-col sm:items-center', className)}>
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && <p className={cn('eyebrow mb-3', tone === 'light' && 'text-white/60')}>{eyebrow}</p>}
        <Tag className={cn('heading-xl', tone === 'light' && 'text-white')}>{title}</Tag>
        {description && <p className={cn('mt-4 text-[15px] sm:text-base', tone === 'light' ? 'text-white/70' : 'text-ink-500')}>{description}</p>}
      </div>
      {action && (
        <Link
          to={action.href}
          className={cn(
            'group inline-flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]',
            tone === 'light' ? 'text-white' : 'text-ink',
          )}
        >
          <span className="link-underline">{action.label}</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** Subtle fade-up when the element first enters the viewport. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn('transition-all duration-700 ease-premium', inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
