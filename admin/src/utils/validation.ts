export type Errors<T> = Partial<Record<keyof T | string, string>>;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isSlug = (v: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
export const isUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
export const isPhone = (v: string) => /^\+?[0-9\s-]{7,20}$/.test(v.trim());

export const required = (v: unknown, label = 'This field') =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)
    ? `${label} is required.`
    : undefined;

export const hasErrors = (errors: Record<string, string | undefined>) => Object.values(errors).some(Boolean);

/** Remove undefined entries so `Object.keys(errors).length` is meaningful. */
export function compact<T extends Record<string, string | undefined>>(errors: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(errors)) if (v) (out as Record<string, string>)[k] = v;
  return out;
}
