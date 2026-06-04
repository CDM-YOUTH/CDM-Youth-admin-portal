import { supabase } from "@/integrations/supabase/client";
import { fetchOrg, resolveOrgIds } from "./org";
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
  } | null;
};

export async function listCusa(year?: number): Promise<CusaRow[]> {
  const y = year ?? new Date().getFullYear();
  const { data, error } = await supabase
    .from("cusa_members")
    .select(
      "*, youth:youths(cdm_id, full_name, gender, deanery:deaneries(name), parish:parishes(name))",
    )
    .eq("year", y)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as unknown as CusaRow[];
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