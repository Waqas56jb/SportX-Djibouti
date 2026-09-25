import { create } from 'zustand';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { ar } from './locales/ar';

/**
 * Storefront internationalisation: English (default), French and Arabic (right-to-left).
 *
 * - `t('ns.key', { var })` works anywhere at render time; `useT()` is the component hook.
 * - Missing keys fall back to English, then to the key itself (and warn once in development).
 * - Plurals: pass `{ count }` and define `key_one` / `key_other` (Arabic may add `_zero`, `_two`,
 *   `_few`, `_many`). The CLDR category comes from `Intl.PluralRules`.
 * - Switching language remounts the app (see App.tsx), so every string, date and price re-renders.
 */
export type Lang = 'en' | 'fr' | 'ar';

export interface LanguageInfo {
  code: Lang;
  /** Name in its own language, shown in the switcher. */
  label: string;
  short: string;
  dir: 'ltr' | 'rtl';
  /** BCP 47 locale for Intl formatting. Arabic keeps Latin digits, as is usual for prices in Djibouti. */
  locale: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', label: 'English', short: 'EN', dir: 'ltr', locale: 'en-GB' },
  { code: 'fr', label: 'Français', short: 'FR', dir: 'ltr', locale: 'fr-FR' },
  { code: 'ar', label: 'العربية', short: 'ع', dir: 'rtl', locale: 'ar-DJ-u-nu-latn' },
];

const STORAGE_KEY = 'sportx-lang';
const DICTS: Record<Lang, Dict> = { en, fr, ar } as unknown as Record<Lang, Dict>;

type Dict = { [k: string]: string | Dict };

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'fr' || saved === 'ar') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

export const languageInfo = (lang: Lang) => LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

function applyDocument(lang: Lang) {
  if (typeof document === 'undefined') return;
  const info = languageInfo(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = info.dir;
}

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
    applyDocument(lang);
    set({ lang });
  },
}));

applyDocument(useLangStore.getState().lang);

export const currentLang = () => useLangStore.getState().lang;
export const currentLocale = () => languageInfo(currentLang()).locale;
export const isRtl = () => languageInfo(currentLang()).dir === 'rtl';

// ───────────────────────── Lookup ─────────────────────────

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type StripPlural<S> = S extends `${infer B}_${PluralSuffix}` ? B : S;
/** Every translation key (plural keys without their `_one` / `_other` suffix). */
export type TKey = StripPlural<Leaves<typeof en>>;
export type TVars = Record<string, string | number | null | undefined>;

function lookup(dict: Dict, key: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const warned = new Set<string>();

function resolve(lang: Lang, key: string, vars?: TVars): string | undefined {
  const dict = DICTS[lang];
  if (vars && typeof vars.count === 'number') {
    const cat = new Intl.PluralRules(languageInfo(lang).locale).select(vars.count);
    const hit = lookup(dict, `${key}_${cat}`) ?? lookup(dict, `${key}_other`);
    if (hit !== undefined) return hit;
  }
  return lookup(dict, key);
}

function interpolate(s: string, vars?: TVars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = vars[name];
    if (v === undefined || v === null) return m;
    return typeof v === 'number' && name === 'count' ? formatCount(v) : String(v);
  });
}

const formatCount = (n: number) => new Intl.NumberFormat(currentLocale()).format(n);

/** Translates `key` into the current language. Safe to call anywhere during render. */
export function t(key: TKey, vars?: TVars): string {
  const lang = currentLang();
  let s = resolve(lang, key, vars);
  if (s === undefined && lang !== 'en') s = resolve('en', key, vars);
  if (s === undefined) {
    if (import.meta.env.DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] missing key "${key}"`);
    }
    return key;
  }
  return interpolate(s, vars);
}

/** Like `t`, for keys built at runtime (e.g. from API enums). Returns `fallback` when the key is missing. */
export function tDynamic(key: string, fallback: string, vars?: TVars): string {
  const lang = currentLang();
  const s = resolve(lang, key, vars) ?? resolve('en', key, vars);
  return s === undefined ? fallback : interpolate(s, vars);
}

/** Component hook: re-renders on language change and exposes direction helpers. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  const info = languageInfo(lang);
  return { t, tDynamic, lang, dir: info.dir, rtl: info.dir === 'rtl', locale: info.locale, setLang: useLangStore.getState().setLang };
}
