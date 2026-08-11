import { supabase } from "@/integrations/supabase/client";
import { likePattern } from "@/lib/utils";
import { fetchOrg, resolveOrgIds } from "../org";
import { createYouth } from "./youths";

export type CusaRow = {
  id: string;
  youth_id: string;
  year: number;
  institution: string;
  course: string | null;
  year_of_study: string | null;
  leadership_role: string | null;
  created_at: string;
  youth?: {
    cdm_id: string;
    full_name: string;
    gender: string;
    deanery: { name: string } | null;
    parish: { name: string } | null;
    outstation: { name: string } | null;
  } | null;
};

export async function listCusa(year?: number): Promise<CusaRow[]> {
  const y = year ?? new Date().getFullYear();
  const { data, error } = await supabase
    .from("cusa_members")
    .select(
      "*, youth:youths(cdm_id, full_name, gender, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name))",
    )
    .eq("year", y)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as unknown as CusaRow[];
}

export async function listCusaPaged(opts: {
  page?: number;
  size?: number;
  q?: string;
  year?: number | null;
  institution?: string | null;
  deaneryId?: string | null;
  parishId?: string | null;
  outstationId?: string | null;
}): Promise<{ data: CusaRow[]; total: number; page: number; size: number }> {
  const page = opts.page ?? 0;
  const size = Math.min(opts.size ?? 25, 100);
  const year = opts.year ?? new Date().getFullYear();

  // Use !inner join when filtering/searching on youth columns so non-matching rows are excluded
  const needsInner = !!(opts.deaneryId || opts.parishId || opts.outstationId || opts.q?.trim());
  const youthJoin = needsInner
    ? "youth:youths!inner(cdm_id, full_name, gender, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name))"
    : "youth:youths(cdm_id, full_name, gender, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name))";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("cusa_members")
    .select(`*, ${youthJoin}`, { count: "exact" })
    .eq("year", year)
    .order("created_at", { ascending: false })
    .range(page * size, page * size + size - 1);

  // Own-table filters
  if (opts.institution) query = query.eq("institution", opts.institution);

  // Embedded table filters — use real table name "youths", not alias "youth"
  if (opts.deaneryId)    query = query.eq("youths.deanery_id",    opts.deaneryId);
  if (opts.parishId)     query = query.eq("youths.parish_id",     opts.parishId);
  if (opts.outstationId) query = query.eq("youths.outstation_id", opts.outstationId);

  // Text search on youth's name and CDM ID
  if (opts.q?.trim()) {
    const t = likePattern(opts.q);
    query = query.or(`cdm_id.ilike.${t},full_name.ilike.${t}`, { referencedTable: "youths" });
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as unknown as CusaRow[], total: count ?? 0, page, size };
}

export type CusaInput = {
  // either link existing youth by cdmId OR create new
  cdmId?: string | null;
  fullName?: string;
  gender?: "Female" | "Male";
  age?: number;
  phone?: string;
  email?: string;
  deaneryName?: string;
  parishName?: string;
  outstationName?: string;
  // CUSA fields
  institution: string;
  course?: string;
  yearOfStudy?: string;
  leadershipRole?: string;
  year?: number;
};

export async function createCusaMember(input: CusaInput) {
  let youthId: string | null = null;
  if (input.cdmId) {
    const { data: y, error } = await supabase
      .from("youths")
      .select("id")
      .eq("cdm_id", input.cdmId)
      .maybeSingle();
    if (error) throw error;
    if (!y) throw new Error(`Youth not found: ${input.cdmId}`);
    youthId = y.id;
  } else {
    if (!input.fullName || !input.gender || !input.age) {
      throw new Error("New CUSA member requires full name, gender and age");
    }
    const created = await createYouth({
      fullName: input.fullName,
      gender: input.gender,
      age: input.age,
      phone: input.phone,
      email: input.email,
      deaneryName: input.deaneryName,
      parishName: input.parishName,
      outstationName: input.outstationName,
      category: "Tertiary",
      institution: input.institution,
      yearOfStudy: input.yearOfStudy,
    });
    youthId = (created as { id: string }).id;
  }
  const y = input.year ?? new Date().getFullYear();
  const { data, error } = await supabase
    .from("cusa_members")
    .upsert(
      {
        youth_id: youthId,
        year: y,
        institution: input.institution,
        course: input.course || null,
        year_of_study: input.yearOfStudy || null,
        leadership_role: input.leadershipRole || null,
      },
      { onConflict: "youth_id,year" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** One-shot idempotent backfill: inserts any Tertiary youth (with institution) who
 *  is not yet in cusa_members for the current year.  Existing rows are left untouched. */
export async function syncTertiaryYouthsToCusa(): Promise<void> {
  const year = new Date().getFullYear();

  const { data: youths, error } = await supabase
    .from("youths")
    .select("id, institution, year_of_study")
    .eq("category", "Tertiary" as never)
    .not("institution", "is", null);

  if (error) throw error;

  const rows = ((youths ?? []) as { id: string; institution: string | null; year_of_study: string | null }[])
    .filter((y) => y.institution?.trim())
    .map((y) => ({
      youth_id: y.id,
      year,
      institution: y.institution!,
      year_of_study: y.year_of_study || null,
      course: null as string | null,
      leadership_role: null as string | null,
    }));

  if (!rows.length) return;

  const { error: upsertErr } = await supabase
    .from("cusa_members")
    .upsert(rows, { onConflict: "youth_id,year", ignoreDuplicates: true });

  if (upsertErr) throw upsertErr;
}

export async function deleteCusaMember(id: string) {
  const { error } = await supabase.from("cusa_members").delete().eq("id", id);
  if (error) throw error;
}

export type CusaUpdateInput = {
  institution?: string;
  course?: string | null;
  yearOfStudy?: string | null;
  leadershipRole?: string | null;
};

export async function updateCusaMember(id: string, input: CusaUpdateInput) {
  const patch: {
    institution?: string;
    course?: string | null;
    year_of_study?: string | null;
    leadership_role?: string | null;
  } = {};
  if (input.institution !== undefined) patch.institution = input.institution;
  if (input.course !== undefined) patch.course = input.course || null;
  if (input.yearOfStudy !== undefined) patch.year_of_study = input.yearOfStudy || null;
  if (input.leadershipRole !== undefined) patch.leadership_role = input.leadershipRole || null;
  const { error } = await supabase.from("cusa_members").update(patch).eq("id", id);
  if (error) throw error;
}

// keep import side-effect free for tree-shaking
export { fetchOrg, resolveOrgIds };