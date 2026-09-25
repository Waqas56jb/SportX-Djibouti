import { useEffect, useRef, useState, type RefObject } from 'react';

export function useDebounce<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} · SPORTX Admin`;
  }, [title]);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Tailwind `lg` breakpoint and up. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
/** Below Tailwind `md`. */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');

export function useClickOutside(refs: RefObject<HTMLElement>[], handler: () => void, active = true) {
  const cb = useRef(handler);
  cb.current = handler;
  useEffect(() => {
    if (!active) return;
    const on = (e: MouseEvent | TouchEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      cb.current();
    };
    document.addEventListener('mousedown', on);
    document.addEventListener('touchstart', on);
    return () => {
      document.removeEventListener('mousedown', on);
      document.removeEventListener('touchstart', on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

/** Global keyboard shortcut, e.g. useHotkey('k', open, { meta: true }). Meta matches Ctrl on Windows/Linux. */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, opts: { meta?: boolean } = {}) {
  const cb = useRef(handler);
  cb.current = handler;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (opts.meta && !(e.metaKey || e.ctrlKey)) return;
      cb.current(e);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [key, opts.meta]);
}
