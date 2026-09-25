import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps list filters in the URL query string so views are shareable and survive refresh.
 * Usage: const [filters, setFilter, reset] = useUrlFilters({ status: '', search: '' });
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();
  const values = useMemo(() => {
    const out = { ...defaults };
    for (const k of Object.keys(defaults) as (keyof T)[]) {
      const v = params.get(k as string);
      if (v !== null) out[k] = v as T[keyof T];
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const set = useCallback(
    (key: keyof T, value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === defaults[key]) next.delete(key as string);
          else next.set(key as string, value);
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  /** Apply several filter changes in one URL update (e.g. changing Module also clears Action). */
  const setMany = useCallback(
    (patch: Partial<Record<keyof T, string>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch) as [keyof T, string | undefined][]) {
            if (!value || value === defaults[key]) next.delete(key as string);
            else next.set(key as string, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  const reset = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const k of Object.keys(defaults)) next.delete(k);
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setParams]);

  const activeCount = Object.keys(defaults).filter((k) => k !== 'search' && values[k] && values[k] !== defaults[k]).length;

  return { filters: values, setFilter: set, setFilters: setMany, resetFilters: reset, activeCount };
}
