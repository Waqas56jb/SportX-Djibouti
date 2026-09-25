export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadFile(filename: string, content: string | Blob, mime = 'text/csv;charset=utf-8') {
  const blob = typeof content === 'string' ? new Blob(['﻿', content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Client-side CSV export used during the frontend phase.
 * When the backend exists, swap callers to `exportService.request(...)` which will
 * return a signed download URL for a server-generated file.
 */
export function exportCsv<T>(name: string, rows: T[], columns: CsvColumn<T>[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`sportx-${name}-${stamp}.csv`, toCsv(rows, columns));
}
