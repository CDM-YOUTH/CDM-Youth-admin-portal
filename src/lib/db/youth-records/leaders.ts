import { supabase } from "@/integrations/supabase/client";
import { fetchOrg, resolveOrgIds } from "../org";
import { likePattern } from "@/lib/utils";

export type LeadershipLevel = "diocese" | "deanery" | "parish" | "outstation";

export type RoleTypeRow = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type LeadershipRoleRow = {
  id: string;
  youth_id: string;
  role_id: string;
  level: LeadershipLevel;
  deanery_id: string | null;
  parish_id: string | null;
  outstation_id: string | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  role_sort_order: number;
  youth?: {
    full_name: string;
    cdm_id: string;
    phone: string | null;
    deanery?: { name: string } | null;
    parish?: { name: string } | null;
    outstation?: { name: string } | null;
  } | null;
  role_type?: { name: string } | null;
  deanery?: { name: string } | null;
  parish?: { name: string } | null;
  outstation?: { name: string } | null;
};

export type LeadershipRoleInput = {
  youthId: string;
  roleId: string;
  level: LeadershipLevel;
  deaneryId?: string | null;
  parishId?: string | null;
  outstationId?: string | null;
  startDate?: string;
  notes?: string | null;
};

export type BulkLeaderRow = {
  cdmId: string;
  roleName: string;
  level: LeadershipLevel;
  deaneryName?: string;
  parishName?: string;
  outstationName?: string;
};

const SEL =
  "*, youth:youths(full_name,cdm_id,phone,deanery:deaneries(name),parish:parishes(name),outstation:outstations(name)), role_type:leadership_role_types(name), deanery:deaneries(name), parish:parishes(name), outstation:outstations(name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any).from("youth_leadership_roles");

export async function listRoleTypes(): Promise<RoleTypeRow[]> {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("leadership_role_types" as any)
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as RoleTypeRow[];
}

export async function createRoleType(name: string): Promise<RoleTypeRow> {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("leadership_role_types" as any)
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as RoleTypeRow;
}

export async function listLeadershipRoles(): Promise<LeadershipRoleRow[]> {
  const { data, error } = await db()
    .select(SEL)
    .order("role_sort_order")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadershipRoleRow[];
}

export async function listLeadersPaged(opts: {
  page?: number;
  size?: number;
  level?: LeadershipLevel | null;
  active?: boolean;
  deaneryId?: string | null;
  parishId?: string | null;
  outstationId?: string | null;
  q?: string;
}): Promise<{ data: LeadershipRoleRow[]; total: number; page: number; size: number }> {
  const page = opts.page ?? 0;
  const size = Math.min(opts.size ?? 25, 500);

  // Use !inner join on youths when doing text search or filtering by youth's org
  const needsInner = !!(opts.q?.trim() || opts.deaneryId || opts.parishId || opts.outstationId);
  const youthJoin = needsInner
    ? "youth:youths!inner(full_name,cdm_id,phone,deanery:deaneries(name),parish:parishes(name),outstation:outstations(name))"
    : "youth:youths(full_name,cdm_id,phone,deanery:deaneries(name),parish:parishes(name),outstation:outstations(name))";
  const sel = `*, ${youthJoin}, role_type:leadership_role_types(name), deanery:deaneries(name), parish:parishes(name), outstation:outstations(name)`;

  let query = db()
    .select(sel, { count: "exact" })
    .order("role_sort_order")
    .order("start_date", { ascending: false })
    .range(page * size, page * size + size - 1);

  if (opts.level)        query = query.eq("level", opts.level);
  if (opts.active)       query = query.is("end_date", null);
  // Filter on the youth's own org, not the role's served-at org, so filters work on any tab level
  if (opts.deaneryId)    query = query.eq("youths.deanery_id", opts.deaneryId);
  if (opts.parishId)     query = query.eq("youths.parish_id", opts.parishId);
  if (opts.outstationId) query = query.eq("youths.outstation_id", opts.outstationId);
  if (opts.q?.trim()) {
    const t = likePattern(opts.q);
    query = query.or(`cdm_id.ilike.${t},full_name.ilike.${t},phone.ilike.${t}`, { referencedTable: "youths" });
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as LeadershipRoleRow[], total: count ?? 0, page, size };
}

export async function appointLeader(input: LeadershipRoleInput): Promise<LeadershipRoleRow> {
  const { data, error } = await db()
    .insert({
      youth_id:      input.youthId,
      role_id:       input.roleId,
      level:         input.level,
      deanery_id:    input.deaneryId    ?? null,
      parish_id:     input.parishId     ?? null,
      outstation_id: input.outstationId ?? null,
      start_date:    input.startDate    ?? new Date().toISOString().slice(0, 10),
      notes:         input.notes?.trim() || null,
    })
    .select(SEL)
    .single();
  if (error) throw error;
  return data as LeadershipRoleRow;
}

export async function endLeaderTerm(id: string): Promise<void> {
  const { error } = await db()
    .update({ end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) throw error;
}

export type LeadershipRoleUpdate = {
  roleId?: string;
  level?: LeadershipLevel;
  startDate?: string;
  notes?: string | null;
};

export async function updateLeader(id: string, input: LeadershipRoleUpdate): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.roleId     !== undefined) patch.role_id    = input.roleId;
  if (input.level      !== undefined) patch.level      = input.level;
  if (input.startDate  !== undefined) patch.start_date = input.startDate;
  if (input.notes      !== undefined) patch.notes      = input.notes?.trim() || null;
  const { error } = await db().update(patch).eq("id", id);
  if (error) throw error;
}

export async function listActiveRolesForYouth(youthId: string): Promise<LeadershipRoleRow[]> {
  const { data, error } = await db()
    .select("id, role_id, level, deanery_id, parish_id, outstation_id, start_date")
    .eq("youth_id", youthId)
    .is("end_date", null);
  if (error) throw error;
  return (data ?? []) as unknown as LeadershipRoleRow[];
}

export async function deleteLeader(id: string): Promise<void> {
  const { error } = await db().delete().eq("id", id);
  if (error) throw error;
}

export async function bulkImportLeaders(
  rows: BulkLeaderRow[],
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const org = await fetchOrg();

  // Load role types once and build a name → id map
  const roleTypes = await listRoleTypes();
  const roleIdByName = new Map(roleTypes.map((r) => [r.name.toLowerCase(), r.id]));

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const cdm = row.cdmId?.trim();
    if (!cdm) { errors.push("Row missing CDM ID — skipped"); skipped++; continue; }
    if (!row.roleName?.trim()) { errors.push(`${cdm}: missing role — skipped`); skipped++; continue; }

    // Resolve role name → UUID (create if unknown)
    let roleId = roleIdByName.get(row.roleName.trim().toLowerCase());
    if (!roleId) {
      try {
        const created = await createRoleType(row.roleName.trim());
        roleId = created.id;
        roleIdByName.set(row.roleName.trim().toLowerCase(), roleId);
      } catch {
        errors.push(`${cdm}: could not create role type "${row.roleName}" — skipped`);
        skipped++;
        continue;
      }
    }

    const { data: youth } = await supabase
      .from("youths")
      .select("id, full_name")
      .eq("cdm_id", cdm)
      .maybeSingle();
    if (!youth) { errors.push(`${cdm}: not found in youth records — skipped`); skipped++; continue; }

    const ids = resolveOrgIds(org, row.deaneryName, row.parishName, row.outstationName);

    // Idempotency: skip if this youth already holds this active role at this unit
    const { data: existing } = await db()
      .select("id")
      .eq("youth_id", youth.id)
      .eq("role_id", roleId)
      .eq("level", row.level)
      .is("end_date", null)
      .maybeSingle();
    if (existing) { skipped++; continue; }

    const { error: insErr } = await db().insert({
      youth_id:      youth.id,
      role_id:       roleId,
      level:         row.level,
      deanery_id:    ids.deanery_id,
      parish_id:     ids.parish_id,
      outstation_id: ids.outstation_id,
      start_date:    new Date().toISOString().slice(0, 10),
    });

    if (insErr) { errors.push(`${cdm}: ${insErr.message}`); skipped++; }
    else { inserted++; }
  }

  return { inserted, skipped, errors };
}
