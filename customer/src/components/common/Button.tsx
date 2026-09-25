import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'accent' | 'light' | 'outline' | 'outline-light' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  light: 'btn-light',
  outline: 'btn-outline',
  'outline-light': 'btn-outline-light',
  ghost: 'btn-ghost',
  link: 'btn-link',
};

const SIZES: Record<ButtonSize, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const buttonClass = ({ variant = 'primary', size = 'md', fullWidth }: BaseProps, extra?: string) =>
  cn('btn group', VARIANTS[variant], SIZES[size], fullWidth && 'w-full', extra);

export interface ButtonProps extends BaseProps, ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shows a spinner, disables the button and announces the busy state. */
  loading?: boolean;
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, leftIcon, rightIcon, loading = false, loadingText, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, fullWidth }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner className="h-4 w-4" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
});

/** Alias kept for readability where a button's main job is async work. */
export const LoadingButton = Button;

interface ButtonLinkProps extends BaseProps, LinkProps {}

export function ButtonLink({ variant, size, fullWidth, leftIcon, rightIcon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, fullWidth }, className)} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
