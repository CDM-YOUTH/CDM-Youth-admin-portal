import { supabase } from "@/integrations/supabase/client";

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
    .select("id")
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
        payment_ref: input.paymentRef || null,
        amount: input.amount ?? null,
        status: input.status ?? "paid",
      },
      { onConflict: "youth_id,year" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function bulkEnroll(cdmIds: string[], sharedRef: string | null, year?: number) {
  if (!cdmIds.length) return { inserted: 0, missing: [] as string[] };
  const { data: youths, error } = await supabase
    .from("youths")
    .select("id, cdm_id")
    .in("cdm_id", cdmIds);
  if (error) throw error;
  const found = new Set((youths ?? []).map((y) => y.cdm_id));
  const missing = cdmIds.filter((c) => !found.has(c));
  const y = year ?? new Date().getFullYear();
  const rows = (youths ?? []).map((yo) => ({
    youth_id: yo.id,
    year: y,
    payment_ref: sharedRef,
    status: "paid" as const,
  }));
  if (rows.length) {
    const { error: insErr } = await supabase
      .from("enrollments")
      .upsert(rows, { onConflict: "youth_id,year" });
    if (insErr) throw insErr;
  }
  return { inserted: rows.length, missing };
}