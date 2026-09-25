import { useCallback, useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  /** Re-run the loader. `silent` keeps current data visible (no skeleton). */
  reload: (silent?: boolean) => Promise<void>;
  setData: Dispatch<SetStateAction<T | undefined>>;
}

/**
 * Loads data from a service function and tracks loading/error state.
 * Stale responses (from earlier deps) are ignored.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList = []): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const reqId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async (silent = false) => {
    const id = ++reqId.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (id === reqId.current) setData(result);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e : new Error('Something went wrong.'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run, setData };
}
