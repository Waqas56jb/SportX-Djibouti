import { useCallback, useState } from 'react';
import { toast } from '@/store/toastStore';

interface Options<R> {
  success?: string | ((r: R) => string);
  error?: string;
  onSuccess?: (r: R) => void;
}

/**
 * Wraps a mutating service call with pending state and toast feedback.
 * Returns `undefined` on failure (the error toast has already been shown).
 */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: Options<R> = {}) {
  const [pending, setPending] = useState(false);
  const mutate = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      try {
        const r = await fn(...args);
        if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
        opts.onSuccess?.(r);
        return r;
      } catch (e) {
        toast.error(opts.error ?? 'Action failed', { description: e instanceof Error ? e.message : undefined });
        return undefined;
      } finally {
        setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn],
  );
  return { mutate, pending };
}
