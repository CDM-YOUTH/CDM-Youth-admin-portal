import { useEffect, useState } from "react";
import type { OrgTree } from "@/lib/db/org";
import type { UserScope } from "@/lib/hooks/use-admin-scope";

/**
 * Resolve a field's value + lock state against the caller's org scope.
 *
 * If the scope pins this level and the current value is empty or already matches the
 * scope, it's locked to the scope value (and the UI should hide the control). If the
 * current value is a *different*, real value (e.g. editing a record whose org differs
 * from the editor's current scope), it's left alone and editable rather than silently
 * overwritten.
 */
export function resolveScoped(scopeId: string | null, initialId?: string) {
  const mismatched = !!(scopeId && initialId && initialId !== scopeId);
  const value = mismatched ? initialId! : (scopeId || initialId || "");
  const locked = !!scopeId && !mismatched;
  return { value, locked };
}

type Options = {
  initialDeaneryId?: string;
  initialParishId?: string;
  initialOutstationId?: string;
  /** Re-seed whenever this changes (e.g. a dialog's `open` boolean). */
  resetKey?: unknown;
};

/**
 * Scope-aware deanery/parish/outstation id state for "Add"/"Edit" dialogs. Seeds and locks
 * each level from the caller's org scope (see `resolveScoped`), cascades parish/outstation
 * options the same way every dialog's hand-rolled cascade already did, and re-seeds when
 * `resetKey` changes or when `scope` resolves asynchronously after mount.
 */
export function useScopedOrgFields(org: OrgTree | undefined, scope: UserScope, opts?: Options) {
  const deanery = resolveScoped(scope.deaneryId, opts?.initialDeaneryId);
  const parish = resolveScoped(scope.parishId, opts?.initialParishId);
  const outstation = resolveScoped(scope.outstationId, opts?.initialOutstationId);

  const [deaneryId, setDeaneryIdRaw] = useState(deanery.value);
  const [parishId, setParishIdRaw] = useState(parish.value);
  const [outstationId, setOutstationIdRaw] = useState(outstation.value);

  useEffect(() => {
    setDeaneryIdRaw(deanery.value);
    setParishIdRaw(parish.value);
    setOutstationIdRaw(outstation.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opts?.resetKey,
    scope.deaneryId,
    scope.parishId,
    scope.outstationId,
    opts?.initialDeaneryId,
    opts?.initialParishId,
    opts?.initialOutstationId,
  ]);

  const setDeaneryId = (v: string) => {
    if (deanery.locked) return;
    setDeaneryIdRaw(v);
    setParishIdRaw("");
    setOutstationIdRaw("");
  };
  const setParishId = (v: string) => {
    if (parish.locked) return;
    setParishIdRaw(v);
    setOutstationIdRaw("");
  };
  const setOutstationId = (v: string) => {
    if (outstation.locked) return;
    setOutstationIdRaw(v);
  };

  const parishOptions = org
    ? deaneryId
      ? org.parishes.filter((p) => p.deanery_id === deaneryId)
      : org.parishes
    : [];

  const outstationOptions = org
    ? parishId
      ? org.outstations.filter((o) => o.parish_id === parishId)
      : deaneryId
        ? org.outstations.filter((o) => parishOptions.some((p) => p.id === o.parish_id))
        : org.outstations
    : [];

  return {
    deaneryId,
    parishId,
    outstationId,
    setDeaneryId,
    setParishId,
    setOutstationId,
    parishOptions,
    outstationOptions,
    deaneryLocked: deanery.locked,
    parishLocked: parish.locked,
    outstationLocked: outstation.locked,
  };
}
