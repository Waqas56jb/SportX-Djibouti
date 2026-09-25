/** Deterministic PRNG so demo data is stable across reloads. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    shuffle: <T,>(arr: readonly T[]): T[] => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample: <T,>(arr: readonly T[], n: number): T[] => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out.slice(0, n);
    },
  };
}

export type Rng = ReturnType<typeof createRng>;

const DAY = 86_400_000;

/** ISO timestamp `days` ago at a given local hour/minute. Anchored to "now" so data always looks current. */
export function daysAgo(days: number, hour = 10, minute = 0): string {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() > Date.now()) d.setTime(Date.now() - 5 * 60_000);
  return d.toISOString();
}

export function daysFromNow(days: number, hour = 0, minute = 0): string {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}
