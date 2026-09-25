/** Safe wrappers — storage can throw in private mode or when quota is full. */
export const storage = {
  get<T>(key: string, fallback: T, area: Storage = localStorage): T {
    try {
      const raw = area.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T, area: Storage = localStorage) {
    try {
      area.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / privacy errors */
    }
  },
  remove(key: string, area: Storage = localStorage) {
    try {
      area.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
