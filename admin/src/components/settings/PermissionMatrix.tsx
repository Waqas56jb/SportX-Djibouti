import type { PermissionKey } from '@/types';
import { cn } from '@/utils/cn';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from '@/constants/permissions';
import { Checkbox } from '@/components/forms/Choice';
import { columnState, keyOf, rowState, setCell, setColumn, setRow } from './permissionRules';

const ACTION_HINT: Record<string, string> = {
  view: 'See pages and records',
  create: 'Add new records',
  edit: 'Change existing records',
  delete: 'Remove records',
  approve: 'Approve, refund, moderate',
  export: 'Download CSV exports',
};

/**
 * Module × action permission grid with row and column "all" toggles.
 * Header row and module column are sticky so the grid stays readable while scrolling.
 */
export function PermissionMatrix({ roleName, value, onChange, readOnly }: { roleName: string; value: PermissionKey[]; onChange: (next: PermissionKey[]) => void; readOnly?: boolean }) {
  const stickyCol = 'sticky left-0 z-10 bg-white group-hover:bg-zinc-50';
  return (
    <div className="max-h-[70vh] overflow-auto scrollbar-thin">
      <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left">
        <caption className="sr-only">Permissions for the {roleName} role. Rows are modules, columns are actions.</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 top-0 z-30 border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Module
            </th>
            <th scope="col" className="sticky top-0 z-20 w-20 border-b border-zinc-200 bg-zinc-50 px-2 py-3 text-center text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              All
            </th>
            {PERMISSION_ACTIONS.map(({ action, label }) => {
              const col = columnState(value, action);
              return (
                <th key={action} scope="col" className="sticky top-0 z-20 w-[92px] border-b border-zinc-200 bg-zinc-50 px-2 py-3 text-center">
                  <div className="flex flex-col items-center gap-1.5" title={ACTION_HINT[action]}>
                    <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-700">{label}</span>
                    <Checkbox ariaLabel={`${label}: all modules`} checked={col.all} indeterminate={col.some} disabled={readOnly} onChange={(on) => onChange(setColumn(value, action, on))} />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_MODULES.map((m) => {
            const row = rowState(value, m.module);
            return (
              <tr key={m.module} className="group">
                <th scope="row" className={cn(stickyCol, 'border-b border-zinc-100 px-5 py-3 text-left font-normal shadow-[1px_0_0_0_rgb(244_244_245)]')}>
                  <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                    {m.label}
                    <span className={cn('rounded px-1.5 py-px text-2xs font-semibold tabular', row.all ? 'bg-ink-950 text-volt' : row.some ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-50 text-zinc-400')}>
                      {row.granted}/{row.total}
                    </span>
                  </p>
                  <p className="mt-0.5 max-w-[240px] text-xs text-zinc-500">{m.description}</p>
                </th>
                <td className="border-b border-zinc-100 bg-zinc-50/40 px-2 py-3 group-hover:bg-zinc-50">
                  <div className="flex justify-center">
                    <Checkbox ariaLabel={`${m.label}: all actions`} checked={row.all} indeterminate={row.some} disabled={readOnly} onChange={(on) => onChange(setRow(value, m.module, on))} />
                  </div>
                </td>
                {PERMISSION_ACTIONS.map(({ action, label }) => (
                  <td key={action} className="border-b border-zinc-100 px-2 py-3 group-hover:bg-zinc-50">
                    <div className="flex justify-center">
                      {m.actions.includes(action) ? (
                        <Checkbox ariaLabel={`${m.label}: ${label}`} checked={value.includes(keyOf(m.module, action))} disabled={readOnly} onChange={(on) => onChange(setCell(value, m.module, action, on))} />
                      ) : (
                        <span className="text-sm text-zinc-300" aria-label={`${m.label}: ${label} not applicable`} role="img">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
