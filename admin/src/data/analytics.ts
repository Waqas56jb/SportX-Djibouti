import { createRng } from './seed';

/**
 * Demo time series for analytics. Values are synthetic and clearly labelled as demo data in the UI.
 * The real backend will aggregate from the orders table (e.g. a Postgres view grouped by day).
 */
export interface DailyMetric {
  date: Date;
  revenue: number;
  orders: number;
  discounts: number;
  refunds: number;
  unitsSold: number;
  newCustomers: number;
  returningCustomers: number;
  visitors: number;
}

const DAYS = 800;
const rng = createRng(2026);

function build(): DailyMetric[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: DailyMetric[] = [];
  for (let d = DAYS - 1; d >= 0; d--) {
    const date = new Date(today.getTime() - d * 86_400_000);
    const dow = date.getDay();
    // Djibouti weekend is Friday; Thursday evening and Saturday are also strong.
    const weekly = dow === 5 ? 1.35 : dow === 4 || dow === 6 ? 1.18 : dow === 0 ? 0.92 : 1;
    const growth = 1 + 0.32 * ((DAYS - d) / DAYS);
    const month = date.getMonth();
    const seasonal = month === 5 ? 1.25 : month === 8 ? 1.15 : month === 11 ? 1.3 : month === 6 || month === 7 ? 0.88 : 1;
    const noise = 0.78 + rng.next() * 0.44;
    const revenue = Math.round((96_000 * weekly * growth * seasonal * noise) / 100) * 100;
    const aov = 19_500 + rng.next() * 4_500;
    const orders = Math.max(1, Math.round(revenue / aov));
    const newCustomers = Math.max(0, Math.round(orders * (0.28 + rng.next() * 0.18)));
    out.push({
      date,
      revenue,
      orders,
      discounts: Math.round(revenue * (0.04 + rng.next() * 0.04)),
      refunds: rng.chance(0.35) ? Math.round(revenue * (0.02 + rng.next() * 0.05)) : 0,
      unitsSold: Math.round(orders * (1.5 + rng.next() * 0.6)),
      newCustomers,
      returningCustomers: Math.max(0, orders - newCustomers),
      visitors: Math.round(orders * (38 + rng.next() * 18)),
    });
  }
  return out;
}

export const dailyMetrics: DailyMetric[] = build();

/** Share of revenue per top-level reporting category. */
export const CATEGORY_WEIGHTS: Record<string, number> = {
  Football: 0.31,
  Running: 0.19,
  Basketball: 0.17,
  Training: 0.13,
  Apparel: 0.12,
  Equipment: 0.08,
};

/** Relative hourly distribution (0–23) for intraday charts. */
export const HOURLY_WEIGHTS = [0.2, 0.1, 0.05, 0.03, 0.03, 0.08, 0.3, 0.6, 0.9, 1.1, 1.2, 1.2, 1.0, 0.8, 0.9, 1.1, 1.3, 1.6, 1.9, 2.1, 2.2, 1.8, 1.1, 0.5];
