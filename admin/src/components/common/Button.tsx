import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'volt' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink-950 text-white hover:bg-ink-800 active:bg-ink-700 shadow-sm disabled:bg-zinc-300 disabled:text-zinc-500',
  secondary: 'bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm disabled:text-zinc-400',
  ghost: 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 disabled:text-zinc-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm disabled:bg-red-300',
  'danger-ghost': 'text-red-600 hover:bg-red-50 disabled:text-red-300',
  volt: 'bg-volt text-ink-950 hover:bg-volt-400 shadow-sm disabled:opacity-60',
  link: 'text-zinc-900 underline-offset-4 hover:underline px-0 h-auto',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-xs gap-1 rounded-md',
  sm: 'h-8 px-3 text-[0.8125rem] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-lg',
};

const ICON: Record<ButtonSize, number> = { xs: 13, sm: 14, md: 16, lg: 17 };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon: Icon, iconRight: IconRight, fullWidth, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        variant !== 'link' && SIZES[size],
        variant === 'link' && 'text-sm font-medium',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={ICON[size]} className="animate-spin" aria-hidden /> : Icon ? <Icon size={ICON[size]} aria-hidden strokeWidth={2} /> : null}
      {children}
      {IconRight && !loading ? <IconRight size={ICON[size]} aria-hidden strokeWidth={2} /> : null}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary' | 'dark';
  badge?: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = 'md', variant = 'ghost', badge, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
        variant === 'ghost' && 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
        variant === 'secondary' && 'border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50 hover:text-zinc-900',
        variant === 'dark' && 'text-zinc-400 hover:bg-white/10 hover:text-white',
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'sm' ? 16 : 18} aria-hidden strokeWidth={1.9} />
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white tabular">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
});
