type ClassValue = string | number | false | null | undefined;

/** Joins truthy class names. Kept dependency-free on purpose. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
