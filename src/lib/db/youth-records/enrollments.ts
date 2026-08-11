import { supabase } from "@/integrations/supabase/client";
import { logEnrollmentAudit } from "../audit";
import { likePattern } from "@/lib/utils";

export type EnrollmentRow = {
  id: string;
  youth_id: string;
  year: number;
  payment_ref: string | null;
  amount: number | null;
  status: "paid" | "pending" | "waived";
  notes: string | null;
  created_at: string;
  youth?: {
    cdm_id: string;
    full_name: string;
    category: string;
    deanery: { name: string } | null;
    parish: { name: string } | null;
    outstation: { name: string } | null;
  } | null;
};

export async function listEnrollments(year?: number): Promise<EnrollmentRow[]> {
  let q = supabase
    .from("enrollments")
    .select(
      "*, youth:youths(cdm_id, full_name, category, deanery:deaneries(name), parish:parishes(name))",
    )
    .order("created_at", { ascending: false })
    .limit(2000);
  if (year) q = q.eq("year", year);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as EnrollmentRow[];
}

export async function listEnrollmentsPaged(opts: {
  page?: number;
  size?: number;
  q?: string;
  year?: number | null;
  status?: string | null;
  deaneryId?: string | null;
  parishId?: string | null;
  outstationId?: string | null;
}): Promise<{ data: EnrollmentRow[]; total: number; page: number; size: number }> {
  const page = opts.page ?? 0;
  const size = Math.min(opts.size ?? 25, 100);

  // Use !inner join when filtering on youth columns so non-matching rows are excluded
  const needsInner = !!(opts.deaneryId || opts.parishId || opts.outstationId || opts.q?.trim());
  const youthJoin = needsInner
    ? "youth:youths!inner(cdm_id, full_name, category, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name))"
    : "youth:youths(cdm_id, full_name, category, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name))";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("enrollments")
    .select(`*, ${youthJoin}`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * size, page * size + size - 1);

  // Own-table filters
  if (opts.year)   query = query.eq("year", opts.year);
  if (opts.status) query = query.eq("status", opts.status);

  // Embedded table filters — use real table name "youths", not alias "youth"
  if (opts.deaneryId)    query = query.eq("youths.deanery_id",    opts.deaneryId);
  if (opts.parishId)     query = query.eq("youths.parish_id",     opts.parishId);
  if (opts.outstationId) query = query.eq("youths.outstation_id", opts.outstationId);

  // Text search on youth name / CDM (own columns of the joined table)
  if (opts.q?.trim()) {
    const t = likePattern(opts.q);
    query = query.or(`cdm_id.ilike.${t},full_name.ilike.${t}`, { referencedTable: "youths" });
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as unknown as EnrollmentRow[], total: count ?? 0, page, size };
}

export type EnrollInput = {
  cdmId: string;
  paymentRef?: string | null;
  amount?: number | null;
  status?: "paid" | "pending" | "waived";
  year?: number;
};

export async function createEnrollment(input: EnrollInput) {
  const { data: youth, error: yErr } = await supabase
    .from("youths")
    .select("id, category")
    .eq("cdm_id", input.cdmId)
    .maybeSingle();
  if (yErr) throw yErr;
  if (!youth) throw new Error(`Youth not found: ${input.cdmId}`);
  const year = input.year ?? new Date().getFullYear();
  const { data, error } = await supabase
    .from("enrollments")
    .upsert(
      {
        youth_id: youth.id,
        year,
        category: youth.category,
        payment_ref: input.paymentRef || null,
        amount: input.amount ?? null,
        status: input.status ?? "paid",
      },
      { onConflict: "youth_id,year" },
    )
    .select()
    .single();
  if (error) throw error;
  await logEnrollmentAudit({
    enrollmentId: data.id,
    youthId: youth.id,
    action: "create",
    after: { cdmId: input.cdmId, year, paymentRef: input.paymentRef ?? null, status: input.status ?? "paid" },
  });
  return data;
}

export async function bulkEnroll(cdmIds: string[], sharedRef: string | null, year?: number) {
  if (!cdmIds.length) return { inserted: 0, missing: [] as string[] };
  const { data: youths, error } = await supabase
    .from("youths")
    .select("id, cdm_id, category")
    .in("cdm_id", cdmIds);
  if (error) throw error;
  const found = new Set((youths ?? []).map((y) => y.cdm_id));
  const missing = cdmIds.filter((c) => !found.has(c));
  const y = year ?? new Date().getFullYear();
  const rows = (youths ?? []).map((yo) => ({
    youth_id: yo.id,
    year: y,
    category: yo.category,
    payment_ref: sharedRef,
    status: "paid" as const,
  }));
  if (rows.length) {
    const { error: insErr } = await supabase
      .from("enrollments")
      .upsert(rows, { onConflict: "youth_id,year" });
    if (insErr) throw insErr;
    await logEnrollmentAudit({
      action: "bulk_create",
      after: { count: rows.length, year: y, sharedRef },
    });
  }
  return { inserted: rows.length, missing };
}

export type BulkEnrollRow = { cdmId: string; paymentRef?: string | null };

/**
 * Bulk enroll with optional per-row payment refs. If a row has no ref, falls
 * back to `sharedRef`. Returns counts and the list of CDM IDs that did not
 * resolve to an existing youth.
 */
export async function bulkEnrollRows(
  rows: BulkEnrollRow[],
  sharedRef: string | null,
  year?: number,
) {
  if (!rows.length) return { inserted: 0, missing: [] as string[] };
  const cdmIds = Array.from(new Set(rows.map((r) => r.cdmId.trim()).filter(Boolean)));
  const { data: youths, error } = await supabase
    .from("youths")
    .select("id, cdm_id, category")
    .in("cdm_id", cdmIds);
  if (error) throw error;
  const byCdm = new Map((youths ?? []).map((y) => [y.cdm_id, y] as const));
  const missing = cdmIds.filter((c) => !byCdm.has(c));
  const y = year ?? new Date().getFullYear();
  const payload = rows
    .map((r) => {
      const yo = byCdm.get(r.cdmId.trim());
      if (!yo) return null;
      return {
        youth_id: yo.id,
        year: y,
        category: yo.category,
        payment_ref: (r.paymentRef && r.paymentRef.trim()) || sharedRef,
        status: "paid" as const,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (payload.length) {
    const { error: insErr } = await supabase
      .from("enrollments")
      .upsert(payload, { onConflict: "youth_id,year" });
    if (insErr) throw insErr;
    await logEnrollmentAudit({
      action: "bulk_create",
      after: { count: payload.length, year: y, sharedRef },
    });
  }
  return { inserted: payload.length, missing };
}

export async function deleteEnrollment(id: string) {
  const { data: prev } = await supabase.from("enrollments").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from("enrollments").delete().eq("id", id);
  if (error) throw error;
  await logEnrollmentAudit({
    enrollmentId: id,
    youthId: prev?.youth_id ?? null,
    action: "delete",
    before: prev as Record<string, unknown> | null,
  });
}

export async function updateEnrollmentStatus(
  id: string,
  status: "paid" | "pending" | "waived",
) {
  const { data: prev } = await supabase.from("enrollments").select("status, youth_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("enrollments").update({ status }).eq("id", id);
  if (error) throw error;
  await logEnrollmentAudit({
    enrollmentId: id,
    youthId: prev?.youth_id ?? null,
    action: "status_change",
    before: { status: prev?.status ?? null },
    after: { status },
  });
}