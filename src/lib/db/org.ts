import { supabase } from "@/integrations/supabase/client";

export type DeaneryRow = { id: string; code: string; name: string };
export type ParishRow = { id: string; deanery_id: string; name: string };
export type OutstationRow = { id: string; parish_id: string; name: string };

export type OrgTree = {
  deaneries: DeaneryRow[];
  parishes: ParishRow[];
  outstations: OutstationRow[];
  byDeaneryName: Map<string, DeaneryRow>;
  parishesByDeaneryName: Map<string, ParishRow[]>;
  outstationsByParishName: Map<string, OutstationRow[]>;
};

export async function fetchOrg(): Promise<OrgTree> {
  const [{ data: deaneries }, { data: parishes }, { data: outstations }] = await Promise.all([
    supabase.from("deaneries").select("*").order("name"),
    supabase.from("parishes").select("*").order("name"),
    supabase.from("outstations").select("*").order("name"),
  ]);
  const d = (deaneries ?? []) as DeaneryRow[];
  const p = (parishes ?? []) as ParishRow[];
  const o = (outstations ?? []) as OutstationRow[];
  const byDeaneryName = new Map(d.map((x) => [x.name, x]));
  const parishesByDeaneryName = new Map<string, ParishRow[]>();
  for (const par of p) {
    const den = d.find((x) => x.id === par.deanery_id);
    if (!den) continue;
    const arr = parishesByDeaneryName.get(den.name) ?? [];
    arr.push(par);
    parishesByDeaneryName.set(den.name, arr);
  }
  const outstationsByParishName = new Map<string, OutstationRow[]>();
  for (const out of o) {
    const par = p.find((x) => x.id === out.parish_id);
    if (!par) continue;
    const arr = outstationsByParishName.get(par.name) ?? [];
    arr.push(out);
    outstationsByParishName.set(par.name, arr);
  }
  return { deaneries: d, parishes: p, outstations: o, byDeaneryName, parishesByDeaneryName, outstationsByParishName };
}

export function resolveOrgIds(
  org: OrgTree,
  deaneryName?: string | null,
  parishName?: string | null,
  outstationName?: string | null,
) {
  const deanery = deaneryName ? org.byDeaneryName.get(deaneryName) : undefined;
  const parish = parishName
    ? (org.parishes.find(
        (p) => p.name === parishName && (!deanery || p.deanery_id === deanery.id),
      ) ?? undefined)
    : undefined;
  const outstation = outstationName
    ? (org.outstations.find(
        (o) => o.name === outstationName && (!parish || o.parish_id === parish.id),
      ) ?? undefined)
    : undefined;
  return {
    deanery_id: deanery?.id ?? null,
    parish_id: parish?.id ?? null,
    outstation_id: outstation?.id ?? null,
  };
}