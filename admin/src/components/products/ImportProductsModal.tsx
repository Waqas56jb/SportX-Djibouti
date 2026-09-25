import { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, AlertTriangle, Info, X } from 'lucide-react';
import { Modal } from '@/components/modals/Overlay';
import { Button } from '@/components/common';
import { FileDropzone } from '@/components/forms';
import { toast } from '@/store/toastStore';
import { downloadFile } from '@/utils/csv';
import { cn } from '@/utils/cn';

const REQUIRED = ['name', 'sku', 'price', 'category', 'brand'];
const TEMPLATE = 'name,sku,price,compare_at_price,category,brand,sport,gender,status,color,size,stock\r\nPredator Elite FG,ADI-PRED-FG,32000,36000,Football Boots,Adidas,football,men,draft,Black,42,12';

interface Preview {
  fileName: string;
  headers: string[];
  rows: string[][];
  missingColumns: string[];
  rowIssues: { row: number; message: string }[];
}

/** Minimal CSV line splitter (quotes aware) — enough for a client-side preview. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"' && quoted) {
      cur += '"';
      i++;
    } else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

async function analyse(file: File): Promise<Preview> {
  const text = (await file.text()).replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headers = (lines[0] ? splitLine(lines[0]) : []).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map(splitLine);
  const missingColumns = REQUIRED.filter((r) => !headers.includes(r));
  const col = (name: string) => headers.indexOf(name);
  const rowIssues: Preview['rowIssues'] = [];
  const skus = new Set<string>();
  rows.forEach((r, i) => {
    const n = i + 2;
    if (col('name') >= 0 && !r[col('name')]) rowIssues.push({ row: n, message: 'Name is empty' });
    const sku = col('sku') >= 0 ? r[col('sku')] : '';
    if (col('sku') >= 0 && !sku) rowIssues.push({ row: n, message: 'SKU is empty' });
    if (sku && skus.has(sku) && col('size') < 0) rowIssues.push({ row: n, message: `Duplicate SKU ${sku}` });
    if (sku) skus.add(sku);
    const price = col('price') >= 0 ? Number(r[col('price')]) : NaN;
    if (col('price') >= 0 && !(price > 0)) rowIssues.push({ row: n, message: 'Price must be a positive number' });
  });
  return { fileName: file.name, headers, rows, missingColumns, rowIssues };
}

export function ImportProductsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) setPreview(null);
  }, [open]);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setReading(true);
    try {
      setPreview(await analyse(f));
    } catch {
      toast.error('We couldn’t read this file.', { description: 'Make sure it is a UTF-8 encoded CSV.' });
    } finally {
      setReading(false);
    }
  };

  const invalidRows = new Set(preview?.rowIssues.map((i) => i.row));
  const validCount = preview ? preview.rows.length - invalidRows.size : 0;
  const canImport = Boolean(preview && preview.missingColumns.length === 0 && validCount > 0);

  const submit = async () => {
    setSubmitting(true);
    setSubmitting(false);
    toast.info('Server-side CSV import is not available yet.', {
      description: `${validCount} valid row(s) checked — nothing was created. Add products one by one for now.`,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Import products"
      description="Upload a CSV to create or update products in bulk."
      dismissible={!submitting}
      footer={
        <>
          <Button variant="ghost" icon={Download} className="mr-auto" onClick={() => downloadFile('sportx-products-template.csv', TEMPLATE)}>
            Template
          </Button>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canImport} loading={submitting} onClick={() => void submit()}>
            {canImport ? `Check ${validCount} rows` : 'Import'}
          </Button>
        </>
      }
    >
      {!preview ? (
        <div className="space-y-4">
          <FileDropzone
            accept=".csv,text/csv"
            multiple={false}
            maxSizeMb={10}
            disabled={reading}
            title={reading ? 'Reading file…' : 'Drop a CSV file here or click to browse'}
            hint="CSV · up to 10 MB · one row per variant"
            onFiles={(f) => void onFiles(f)}
            onReject={(m) => toast.error(m)}
          />
          <div className="flex gap-3 rounded-xl bg-zinc-50 p-4 text-[0.8125rem] text-zinc-600">
            <Info size={16} className="mt-0.5 shrink-0 text-zinc-400" aria-hidden />
            <p>
              Required columns: {REQUIRED.map((r) => <code key={r} className="mx-0.5 rounded bg-white px-1 py-px font-mono text-xs text-zinc-800 ring-1 ring-zinc-200">{r}</code>)}. The file is validated here.
              Bulk import on the server is not available yet — this preview only checks your file.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
              <FileSpreadsheet size={19} className="text-zinc-600" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-zinc-900">{preview.fileName}</div>
              <div className="text-xs text-zinc-500">
                {preview.rows.length} rows · {preview.headers.length} columns
              </div>
            </div>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setPreview(null)}>
              Replace
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Rows detected" value={preview.rows.length} />
            <Stat label="Ready to import" value={validCount} tone="ok" />
            <Stat label="With issues" value={invalidRows.size} tone={invalidRows.size ? 'warn' : undefined} />
          </div>

          {preview.missingColumns.length > 0 ? (
            <Callout tone="danger" title="Missing required columns">
              {preview.missingColumns.join(', ')}. Download the template to see the expected format.
            </Callout>
          ) : preview.rowIssues.length > 0 ? (
            <Callout tone="warn" title={`${invalidRows.size} rows will be skipped`}>
              <ul className="mt-1 space-y-0.5">
                {preview.rowIssues.slice(0, 5).map((i, k) => (
                  <li key={k}>
                    Row {i.row}: {i.message}
                  </li>
                ))}
                {preview.rowIssues.length > 5 && <li>…and {preview.rowIssues.length - 5} more</li>}
              </ul>
            </Callout>
          ) : (
            <Callout tone="ok" title="All rows look valid">
              SKUs, names and prices passed the client-side checks.
            </Callout>
          )}

          {preview.headers.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 scrollbar-thin">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">First rows of the uploaded file</caption>
                <thead className="bg-zinc-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold text-zinc-500">#</th>
                    {preview.headers.slice(0, 7).map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wider text-zinc-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {preview.rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className={cn(invalidRows.has(i + 2) && 'bg-amber-50/60')}>
                      <td className="px-3 py-2 tabular text-zinc-400">{i + 2}</td>
                      {preview.headers.slice(0, 7).map((_, c) => (
                        <td key={c} className="max-w-[160px] truncate whitespace-nowrap px-3 py-2 text-zinc-700">
                          {r[c] || <span className="text-zinc-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-xl border border-zinc-200 px-4 py-3">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className={cn('mt-1 font-display text-2xl font-bold tabular', tone === 'ok' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-zinc-950')}>{value}</div>
    </div>
  );
}

function Callout({ tone, title, children }: { tone: 'ok' | 'warn' | 'danger'; title: string; children: React.ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tone === 'ok' ? 'status' : 'alert'} className={cn('flex gap-3 rounded-xl p-4 text-[0.8125rem]', tone === 'ok' && 'bg-emerald-50 text-emerald-800', tone === 'warn' && 'bg-amber-50 text-amber-900', tone === 'danger' && 'bg-red-50 text-red-800')}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5 opacity-90">{children}</div>
      </div>
    </div>
  );
}
