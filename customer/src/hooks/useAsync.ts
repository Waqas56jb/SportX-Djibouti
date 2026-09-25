import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { errorMessage } from '@/services';
import type { AsyncStatus } from '@/types';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  status: AsyncStatus;
  loading: boolean;
  reload: () => void;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Runs an async loader whenever `deps` change. Stale responses are ignored,
 * so rapid filter changes never render out-of-order results.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList, options: { enabled?: boolean; keepPrevious?: boolean } = {}): AsyncState<T> {
  const { enabled = true, keepPrevious = false } = options;
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AsyncStatus>(enabled ? 'loading' : 'idle');
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    const id = ++requestId.current;
    setStatus('loading');
    setError(null);
    if (!keepPrevious) setDataState(undefined);
    loaderRef
      .current()
      .then((result) => {
        if (id !== requestId.current) return;
        setDataState(result);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(errorMessage(err));
        setStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof updater === 'function' ? (updater as (p: T | undefined) => T)(prev) : updater));
  }, []);

  return { data, error, status, loading: status === 'loading', reload, setData };
}
