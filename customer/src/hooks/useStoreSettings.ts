import { useEffect, useState } from 'react';
import { storeService, type StoreSettings } from '@/services/storeService';

/** Public store settings (`GET /store`), cached across the app. Undefined until loaded. */
export function useStoreSettings(): StoreSettings | undefined {
  const [settings, setSettings] = useState<StoreSettings | undefined>(() => storeService.peek());
  useEffect(() => {
    let active = true;
    storeService
      .get()
      .then((s) => active && setSettings(s))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return settings;
}
