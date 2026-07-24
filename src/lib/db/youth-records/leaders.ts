import { supabase } from "@/integrations/supabase/client";
import { fetchOrg, resolveOrgIds } from "../org";

export type LeadershipLevel = "diocese" | "deanery" | "parish" | "outstation";

export type LeadershipRoleRow = {
  id: string;
  youth_id: string;
  role: string;
  level: LeadershipLevel;
  deanery_id: string | null;
  parish_id: string | null;
  outstation_id: string | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  youth?: { full_name: string; cdm_id: string; phone: string | null } | null;
  deanery?: { name: string } | null;
  parish?: { name: string } | null;
  outstation?: { name: string } | null;
};

export type LeadershipRoleInput = {
  youthId: string;
  role: string;
  level: LeadershipLevel;
  deaneryId?: string | null;
  parishId?: string | null;
  outstationId?: string | null;
  startDate?: string;
  notes?: string | null;
};

export type BulkLeaderRow = {
  cdmId: string;
  role: string;
  level: LeadershipLevel;
  deaneryName?: string;
  parishName?: string;
  outstationName?: string;
};

const SEL =
  "*, youth:youths(full_name,cdm_id,phone), deanery:deaneries(name), parish:parishes(name), outstation:outstations(name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any).from("youth_leadership_roles");

export async function listLeadershipRoles(): Promise<LeadershipRoleRow[]> {
  const { data, error } = await db().select(SEL).order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadershipRoleRow[];
}

export async function appointLeader(input: LeadershipRoleInput): Promise<LeadershipRoleRow> {
  const { data, error } = await db()
    .insert({
      youth_id:      input.youthId,
      role:          input.role.trim(),
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
  role?: string;
  level?: LeadershipLevel;
  startDate?: string;
  notes?: string | null;
};

export async function updateLeader(id: string, input: LeadershipRoleUpdate): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.role      !== undefined) patch.role       = input.role.trim();
  if (input.level     !== undefined) patch.level      = input.level;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.notes     !== undefined) patch.notes      = input.notes?.trim() || null;
  const { error } = await db().update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteLeader(id: string): Promise<void> {
  const { error } = await db().delete().eq("id", id);
  if (error) throw error;
}

export async function bulkImportLeaders(
  rows: BulkLeaderRow[],
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const org = await fetchOrg();
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const cdm = row.cdmId?.trim();
    if (!cdm) { errors.push("Row missing CDM ID — skipped"); skipped++; continue; }
    if (!row.role?.trim()) { errors.push(`${cdm}: missing role — skipped`); skipped++; continue; }

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
      .eq("role", row.role.trim())
      .eq("level", row.level)
      .is("end_date", null)
      .maybeSingle();
    if (existing) { skipped++; continue; }

    const { error: insErr } = await db().insert({
      youth_id:      youth.id,
      role:          row.role.trim(),
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
