import type { Request, Response } from 'express';
import { hasPermission } from '../../middleware/role.middleware.js';
import { forbidden } from '../../utils/errors.js';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/**
 * RFC 4180 CSV. Cells that a spreadsheet would treat as a formula (=, +, -, @, tab, CR) are prefixed
 * with an apostrophe so exported customer/product text can never execute in Excel (CSV injection).
 */
function cell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => cell(c.value(r))).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/** CSV export needs reports:export on top of the route's view permission. */
export function assertCanExport(req: Request) {
  if (!hasPermission(req.auth, 'reports:export')) throw forbidden('Missing permission: reports:export.');
}

export function sendCsv(res: Response, filename: string, body: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.setHeader('Cache-Control', 'no-store');
  // BOM so Excel opens UTF-8 (accents in Djiboutian names) correctly.
  return res.status(200).send(`﻿${body}`);
}
