import type { PermissionAction, PermissionKey, PermissionModule } from '@/types';
import { ALL_PERMISSIONS, PERMISSION_MODULES } from '@/constants/permissions';

/**
 * Pure helpers for the role permission matrix. Rules:
 *  - granting create/edit/delete/approve/export also grants view on that module;
 *  - revoking view clears every permission on that module.
 */
export const keyOf = (m: PermissionModule, a: PermissionAction) => `${m}:${a}` as PermissionKey;

const supports = (m: PermissionModule, a: PermissionAction) => PERMISSION_MODULES.find((x) => x.module === m)?.actions.includes(a) ?? false;

function normalise(set: Set<PermissionKey>): PermissionKey[] {
  // Keep canonical order (module order, then action order) so dirty checks are stable.
  return ALL_PERMISSIONS.filter((k) => set.has(k));
}

export function setCell(perms: PermissionKey[], m: PermissionModule, a: PermissionAction, on: boolean): PermissionKey[] {
  if (!supports(m, a)) return perms;
  const set = new Set(perms);
  if (on) {
    set.add(keyOf(m, a));
    set.add(keyOf(m, 'view'));
  } else if (a === 'view') {
    for (const k of [...set]) if (k.startsWith(`${m}:`)) set.delete(k);
  } else set.delete(keyOf(m, a));
  return normalise(set);
}

export function setRow(perms: PermissionKey[], m: PermissionModule, on: boolean): PermissionKey[] {
  const mod = PERMISSION_MODULES.find((x) => x.module === m);
  if (!mod) return perms;
  const set = new Set(perms);
  for (const a of mod.actions) (on ? set.add(keyOf(m, a)) : set.delete(keyOf(m, a)));
  return normalise(set);
}

export function setColumn(perms: PermissionKey[], a: PermissionAction, on: boolean): PermissionKey[] {
  let next = perms;
  for (const mod of PERMISSION_MODULES) if (mod.actions.includes(a)) next = setCell(next, mod.module, a, on);
  return next;
}

export function rowState(perms: PermissionKey[], m: PermissionModule) {
  const mod = PERMISSION_MODULES.find((x) => x.module === m)!;
  const granted = mod.actions.filter((a) => perms.includes(keyOf(m, a))).length;
  return { granted, total: mod.actions.length, all: granted === mod.actions.length, some: granted > 0 };
}

export function columnState(perms: PermissionKey[], a: PermissionAction) {
  const mods = PERMISSION_MODULES.filter((x) => x.actions.includes(a));
  const granted = mods.filter((x) => perms.includes(keyOf(x.module, a))).length;
  return { granted, total: mods.length, all: granted === mods.length && mods.length > 0, some: granted > 0 };
}

export const sortPerms = (perms: PermissionKey[]) => normalise(new Set(perms));
