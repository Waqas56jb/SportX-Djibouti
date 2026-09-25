/**
 * Shape a translation must follow: every English key is required (as a string), extra keys are
 * allowed so languages can add their own plural forms (e.g. Arabic `_two`, `_few`, `_many`).
 */
export type LocaleShape<T> = { [K in keyof T]: T[K] extends string ? string : LocaleShape<T[K]> } & { [extra: string]: unknown };
