import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Load local dotenv files (never override platform vars) and strip surrounding quotes.
 * Railway's raw editor often stores NODE_ENV="production" with the quotes, which crashes Zod
 * (`"production"` ≠ `production`) and turns TRUST_PROXY / DATABASE_POOL_MAX into NaN.
 */
export function bootEnv(): void {
  for (const file of ['.env', '.env.local', '.env.production']) {
    const full = path.resolve(process.cwd(), file);
    if (fs.existsSync(full)) dotenv.config({ path: full, override: false });
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    let next = value.replace(/^\uFEFF/, '').trim();
    next = next.replace(/^["'`\u201c\u201d]+|["'`\u201c\u201d]+$/g, '').trim();
    process.env[key] = next;
  }

  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'development' || nodeEnv === 'test') process.env.NODE_ENV = nodeEnv;
}

bootEnv();
