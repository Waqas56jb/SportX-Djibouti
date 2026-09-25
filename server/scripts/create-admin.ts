/**
 * Provision a staff account without ever putting a password in source control.
 *
 *   ADMIN_EMAIL=owner@sportx.dj ADMIN_PASSWORD='…' npm run create-admin
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_ROLE=ORDER_MANAGER ADMIN_FIRST_NAME=Kadra npm run create-admin
 *
 * Roles: SUPER_ADMIN, ADMIN, PRODUCT_MANAGER, ORDER_MANAGER, INVENTORY_MANAGER, SUPPORT_MANAGER.
 */
import 'dotenv/config';
import { pool } from '../src/config/database.js';
import { provisionUser } from '../src/modules/auth/provisioning.js';
import { PASSWORD_RULE } from '../src/modules/auth/password.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (environment variables, not arguments).');
  process.exit(1);
}
if (!PASSWORD_RULE.test(password)) {
  console.error('ADMIN_PASSWORD must be 8–128 characters with at least one letter and one number.');
  process.exit(1);
}
try {
  const res = await provisionUser({
    email,
    password,
    firstName: process.env.ADMIN_FIRST_NAME ?? 'Store',
    lastName: process.env.ADMIN_LAST_NAME ?? 'Admin',
    roleSlug: process.env.ADMIN_ROLE ?? 'SUPER_ADMIN',
  });
  console.log(res.created ? `Created ${email} (${process.env.ADMIN_ROLE ?? 'SUPER_ADMIN'}).` : `Granted ${process.env.ADMIN_ROLE ?? 'SUPER_ADMIN'} to existing account ${email}.`);
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
