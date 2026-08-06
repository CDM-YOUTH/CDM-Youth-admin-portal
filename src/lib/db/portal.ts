import { supabase } from "@/integrations/supabase/client";
import type { YouthCategory, Gender } from "./youth-records/youths";

export type MyYouth = {
  id: string;
  cdm_id: string;
  full_name: string;
  gender: Gender;
  age: number;
  phone: string | null;
  email: string | null;
  category: YouthCategory;
  parish_id: string | null;
  deanery_id: string | null;
  passport_url: string | null;
  parish?: { name: string } | null;
  deanery?: { name: string } | null;
};

export async function getMyYouth(): Promise<MyYouth | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("youths")
    .select(
      "id, cdm_id, full_name, gender, age, phone, email, category, parish_id, deanery_id, passport_url, parish:parishes(name), deanery:deaneries(name)",
    )
    .eq("auth_user_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as MyYouth | null;
}

export async function claimYouthByCdmId(cdmId: string): Promise<MyYouth> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const clean = cdmId.trim().toUpperCase();
  const { data: existing, error: findErr } = await supabase
    .from("youths")
    .select("id, auth_user_id")
    .eq("cdm_id", clean)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!existing) throw new Error(`No youth record found for ${clean}`);
  if (existing.auth_user_id && existing.auth_user_id !== u.user.id) {
    throw new Error("This CDM ID is already claimed by another account");
  }
  const { error: upErr } = await supabase
    .from("youths")
    .update({ auth_user_id: u.user.id })
    .eq("id", existing.id);
  if (upErr) throw upErr;
  const me = await getMyYouth();
  if (!me) throw new Error("Failed to load profile after claim");
  return me;
}

export type CreateMyYouthInput = {
  fullName: string;
  gender: Gender;
  age: number;
  phone?: string;
  category: YouthCategory;
  parishName?: string;
  deaneryName?: string;
};

export async function createMyYouth(input: CreateMyYouthInput): Promise<MyYouth> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");

  let parish_id: string | null = null;
  let deanery_id: string | null = null;
  if (input.parishName) {
    const { data: p } = await supabase
      .from("parishes")
      .select("id, deanery_id")
      .eq("name", input.parishName)
      .maybeSingle();
    if (p) {
      parish_id = p.id;
      deanery_id = p.deanery_id;
    }
  }
  if (!deanery_id && input.deaneryName) {
    const { data: d } = await supabase
      .from("deaneries")
      .select("id")
      .eq("name", input.deaneryName)
      .maybeSingle();
    if (d) deanery_id = d.id;
  }

  const { data, error } = await supabase
    .from("youths")
    .insert({
      full_name: input.fullName.trim(),
      gender: input.gender,
      age: input.age,
      phone: input.phone ?? null,
      email: u.user.email ?? null,
      category: input.category,
      parish_id,
      deanery_id,
      auth_user_id: u.user.id,
    })
    .select(
      "id, cdm_id, full_name, gender, age, phone, email, category, parish_id, deanery_id, passport_url, parish:parishes(name), deanery:deaneries(name)",
    )
    .single();
  if (error) throw error;
  return data as unknown as MyYouth;
}

export async function listUpcomingEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select("id, name, event_date, venue, organization_level, deanery:deaneries(name), parish:parishes(name)")
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function listMyEnrollments(youthId: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, year, amount, status, payment_ref, category, created_at")
    .eq("youth_id", youthId)
    .order("year", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function enrollMeForYear(youthId: string, year: number, paymentRef?: string) {
  const { data: y } = await supabase.from("youths").select("category").eq("id", youthId).single();
  const { error } = await supabase.from("enrollments").upsert(
    {
      youth_id: youthId,
      year,
      payment_ref: paymentRef ?? null,
      status: "pending",
      category: y?.category ?? null,
    },
    { onConflict: "youth_id,year" },
  );
  if (error) throw error;
}

export async function registerMeForEvent(eventId: string, youth: MyYouth) {
  const { error } = await supabase.from("event_registrations").upsert(
    {
      event_id: eventId,
      youth_id: youth.id,
      guest_name: null,
      guest_phone: youth.phone,
      guest_email: youth.email,
    },
    { onConflict: "event_id,youth_id" },
  );
  if (error) throw error;
}