import { supabase } from "@/integrations/supabase/client";
import { fetchOrg, resolveOrgIds, type OrgTree } from "./org";

export type YouthCategory = "Primary" | "Secondary" | "Tertiary" | "Working";
export type Gender = "Female" | "Male";

export type YouthRow = {
  id: string;
  cdm_id: string;
  full_name: string;
  gender: Gender;
  age: number;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  deanery_id: string | null;
  parish_id: string | null;
  outstation_id: string | null;
  category: YouthCategory;
  institution: string | null;
  year_of_study: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
  deanery?: { name: string } | null;
  parish?: { name: string } | null;
  outstation?: { name: string } | null;
  enrollments?: { id: string }[];
};

export async function listYouths(): Promise<YouthRow[]> {
  const { data, error } = await supabase
    .from("youths")
    .select(
      "*, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name), enrollments(id)",
    )
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as unknown as YouthRow[];
}

export type YouthInput = {
  fullName: string;
  gender: Gender;
  age: number;
  phone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  deaneryName?: string | null;
  parishName?: string | null;
  outstationName?: string | null;
  category: YouthCategory;
  institution?: string | null;
  yearOfStudy?: string | null;
  notes?: string | null;
};

function toRow(input: YouthInput, org: OrgTree) {
  const ids = resolveOrgIds(org, input.deaneryName, input.parishName, input.outstationName);
  return {
    full_name: input.fullName.trim(),
    gender: input.gender,
    age: input.age,
    phone: input.phone || null,
    alt_phone: input.altPhone || null,
    email: input.email || null,
    deanery_id: ids.deanery_id,
    parish_id: ids.parish_id,
    outstation_id: ids.outstation_id,
    category: input.category,
    institution: input.institution || null,
    year_of_study: input.yearOfStudy || null,
    notes: input.notes || null,
  };
}

export async function createYouth(input: YouthInput) {
  const org = await fetchOrg();
  const { data, error } = await supabase.from("youths").insert(toRow(input, org)).select().single();
  if (error) throw error;
  return data;
}

export async function updateYouth(id: string, input: YouthInput) {
  const org = await fetchOrg();
  const { data, error } = await supabase.from("youths").update(toRow(input, org)).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteYouth(id: string) {
  const { error } = await supabase.from("youths").delete().eq("id", id);
  if (error) throw error;
}

export async function bulkInsertYouths(rows: YouthInput[]) {
  const org = await fetchOrg();
  const payload = rows.map((r) => toRow(r, org));
  const { data, error } = await supabase.from("youths").insert(payload).select("id, cdm_id, full_name");
  if (error) throw error;
  return data ?? [];
}

export async function searchYouths(q: string, limit = 25): Promise<YouthRow[]> {
  if (!q.trim()) return [];
  const term = `%${q.trim()}%`;
  const { data, error } = await supabase
    .from("youths")
    .select("*, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name)")
    .or(`full_name.ilike.${term},cdm_id.ilike.${term},phone.ilike.${term}`)
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as YouthRow[];
}