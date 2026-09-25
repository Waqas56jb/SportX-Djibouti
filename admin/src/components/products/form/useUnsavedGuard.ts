import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { confirm } from '@/store/confirmStore';

/**
 * Blocks in-app navigation and tab close while the form has unsaved changes.
 * Call `bypass()` right before navigating after a successful save.
 */
export function useUnsavedGuard(dirty: boolean) {
  const skip = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !skip.current && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let active = true;
    void confirm({
      title: 'Discard unsaved changes?',
      description: 'You have changes that haven’t been saved. If you leave now, they will be lost.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    }).then((ok) => {
      if (!active) return;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      active = false;
    };
  }, [blocker]);

  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => {
      if (skip.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);

  const bypass = useCallback(() => {
    skip.current = true;
  }, []);
  return { bypass };
}
