export type Validator<T = string> = (value: T) => string | undefined;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const required =
  (message = 'This field is required'): Validator =>
  (v) =>
    v.trim() ? undefined : message;

export const email: Validator = (v) => (!v.trim() ? 'Email is required' : EMAIL_RE.test(v.trim()) ? undefined : 'Enter a valid email address');

/** Accepts Djibouti numbers (+253 followed by 8 digits) and general international formats. */
export const phone: Validator = (v) => {
  const digits = v.replace(/[^\d]/g, '');
  if (!digits) return 'Phone number is required';
  if (digits.length < 8 || digits.length > 15) return 'Enter a valid phone number';
  return undefined;
};

export const minLength =
  (n: number, label = 'This field'): Validator =>
  (v) =>
    v.trim().length >= n ? undefined : `${label} must be at least ${n} characters`;

export const password: Validator = (v) => {
  if (!v) return 'Password is required';
  if (v.length < 8) return 'Use at least 8 characters';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Include at least one letter and one number';
  return undefined;
};

export function passwordStrength(v: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (v.length >= 8) score++;
  if (v.length >= 12) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}

/** Runs a validator map against values and returns only failing fields. */
export function validate<T extends object>(
  values: T,
  rules: Partial<Record<keyof T, Validator>>,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  (Object.keys(rules) as (keyof T)[]).forEach((key) => {
    const rule = rules[key];
    const raw = values[key];
    const message = rule?.(typeof raw === 'string' ? raw : '');
    if (message) errors[key] = message;
  });
  return errors;
}

// ---- Card helpers (format/validation only — card data is never stored) ----

export const formatCardNumber = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

export const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
};

export const luhn = (num: string) => {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 12) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
};

export const cardExpiry: Validator = (v) => {
  const m = v.match(/^(\d{2})\s?\/\s?(\d{2})$/);
  if (!m) return 'Use MM / YY';
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return 'Invalid month';
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return 'Card has expired';
  return undefined;
};
