import { supabase } from "@/integrations/supabase/client";

export type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  description: string | null;
  organization_level: "Diocese" | "Deanery" | "Parish" | "Outstation" | null;
  deanery: { name: string } | null;
  parish: { name: string } | null;
};

export type EventInput = {
  name: string;
  eventDate?: string | null;
  venue?: string | null;
  description?: string | null;
  organizationLevel?: EventRow["organization_level"];
  deaneryName?: string | null;
  parishName?: string | null;
};

async function resolveOrgIds(deaneryName?: string | null, parishName?: string | null) {
  let deanery_id: string | null = null;
  let parish_id: string | null = null;
  if (deaneryName) {
    const { data } = await supabase.from("deaneries").select("id").eq("name", deaneryName).maybeSingle();
    deanery_id = data?.id ?? null;
  }
  if (parishName) {
    const { data } = await supabase.from("parishes").select("id").eq("name", parishName).maybeSingle();
    parish_id = data?.id ?? null;
  }
  return { deanery_id, parish_id };
}

export async function listEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, event_date, venue, description, organization_level, deanery:deaneries(name), parish:parishes(name)")
    .order("event_date", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as EventRow[];
}

export async function createEvent(input: EventInput): Promise<EventRow> {
  const { deanery_id, parish_id } = await resolveOrgIds(input.deaneryName, input.parishName);
  const { data, error } = await supabase
    .from("events")
    .insert({
      name: input.name,
      event_date: input.eventDate || null,
      venue: input.venue || null,
      description: input.description || null,
      organization_level: input.organizationLevel || null,
      deanery_id,
      parish_id,
    })
    .select("id, name, event_date, venue, description, organization_level, deanery:deaneries(name), parish:parishes(name)")
    .single();
  if (error) throw error;
  return data as unknown as EventRow;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export type EventCounts = { registered: number; checkedIn: number };

export async function getEventCounts(eventId: string): Promise<EventCounts> {
  const [reg, ci] = await Promise.all([
    supabase.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("event_checkins").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  return { registered: reg.count ?? 0, checkedIn: ci.count ?? 0 };
}

export async function registerForEvent(input: {
  eventId: string;
  cdmId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  notes?: string | null;
}) {
  let youth_id: string | null = null;
  if (input.cdmId) {
    const { data: y, error } = await supabase
      .from("youths")
      .select("id")
      .eq("cdm_id", input.cdmId.trim())
      .maybeSingle();
    if (error) throw error;
    if (!y) throw new Error(`Youth not found: ${input.cdmId}`);
    youth_id = y.id;
  }
  if (!youth_id && !input.guestName) {
    throw new Error("Provide a CDM No. or guest name");
  }
  const { error } = await supabase.from("event_registrations").upsert(
    {
      event_id: input.eventId,
      youth_id,
      guest_name: input.guestName || null,
      guest_phone: input.guestPhone || null,
      guest_email: input.guestEmail || null,
      notes: input.notes || null,
    },
    { onConflict: "event_id,youth_id" },
  );
  if (error) throw error;
}

export async function listRegistrations(eventId: string) {
  const { data, error } = await supabase
    .from("event_registrations")
    .select("id, guest_name, guest_phone, guest_email, notes, created_at, youth:youths(cdm_id, full_name, parish:parishes(name))")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return data ?? [];
}

export async function getEventsAnalytics() {
  const today = new Date().toISOString().slice(0, 10);
  const [up, done, regCount] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date", today),
    supabase.from("events").select("id", { count: "exact", head: true }).lt("event_date", today),
    supabase.from("event_registrations").select("id", { count: "exact", head: true }),
  ]);
  return {
    upcoming: up.count ?? 0,
    done: done.count ?? 0,
    registered: regCount.count ?? 0,
  };
}