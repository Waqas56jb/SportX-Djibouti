export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Human-friendly order number, e.g. SPX-260925-4821. */
export const orderNumber = (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SPX-${yy}${mm}${dd}-${rand}`;
};

/** Adds business days (Mon–Sat delivery week; Fridays are skipped in Djibouti). */
export const addBusinessDays = (from: Date, days: number) => {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 5) added++;
  }
  return d;
};
