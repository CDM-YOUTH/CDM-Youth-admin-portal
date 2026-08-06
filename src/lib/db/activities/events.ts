import { supabase } from "@/integrations/supabase/client";
import { likePattern } from "@/lib/utils";

export type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  description: string | null;
  poster_url: string | null;
  organization_level: "Diocese" | "Deanery" | "Parish" | "Outstation" | null;
  deanery: { name: string } | null;
  parish: { name: string } | null;
};

export type EventProgramItem = {
  id: string;
  activity: string;
  start_time: string | null;
  end_time: string | null;
  position: number;
};

export type EventDutyAssignee = {
  id: string;
  name: string;
  youth_id: string | null;
  deanery: { name: string } | null;
  parish: { name: string } | null;
};

export type EventDuty = {
  id: string;
  title: string;
  position: number;
  assignees: EventDutyAssignee[];
};

export type EventDutyCategory = {
  id: string;
  name: string;
  position: number;
  duties: EventDuty[];
};

export type EventRegistration = {
  id: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  notes: string | null;
  created_at: string;
  youth: {
    cdm_id: string;
    full_name: string;
    phone: string | null;
    deanery: { name: string } | null;
    parish: { name: string } | null;
    outstation: { name: string } | null;
  } | null;
};

export type EventFull = EventRow & {
  program: EventProgramItem[];
  duty_categories: EventDutyCategory[];
  registrations: EventRegistration[];
  checkin_count: number;
};

export type EventInput = {
  name: string;
  eventDate?: string | null;
  venue?: string | null;
  description?: string | null;
  posterUrl?: string | null;
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
    .select("id, name, event_date, venue, description, poster_url, organization_level, deanery:deaneries(name), parish:parishes(name)")
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
      poster_url: input.posterUrl || null,
      organization_level: input.organizationLevel || null,
      deanery_id,
      parish_id,
    })
    .select("id, name, event_date, venue, description, poster_url, organization_level, deanery:deaneries(name), parish:parishes(name)")
    .single();
  if (error) throw error;
  return data as unknown as EventRow;
}

export async function updateEvent(id: string, input: EventInput): Promise<EventRow> {
  const { deanery_id, parish_id } = await resolveOrgIds(input.deaneryName, input.parishName);
  const { data, error } = await supabase
    .from("events")
    .update({
      name: input.name,
      event_date: input.eventDate || null,
      venue: input.venue || null,
      description: input.description || null,
      poster_url: input.posterUrl || null,
      organization_level: input.organizationLevel || null,
      deanery_id,
      parish_id,
    })
    .eq("id", id)
    .select("id, name, event_date, venue, description, poster_url, organization_level, deanery:deaneries(name), parish:parishes(name)")
    .single();
  if (error) throw error;
  return data as unknown as EventRow;
}

type ProgramSlotInput = { startTime: string; endTime: string; activities: { name: string }[] };

export async function saveEventProgram(eventId: string, program: ProgramSlotInput[]): Promise<void> {
  const { error: delErr } = await supabase.from("event_program_items").delete().eq("event_id", eventId);
  if (delErr) throw delErr;
  const items = program.flatMap((slot, si) =>
    slot.activities
      .filter((a) => a.name.trim())
      .map((a, ai) => ({
        event_id: eventId,
        activity: a.name,
        start_time: slot.startTime || null,
        end_time: slot.endTime || null,
        position: si * 100 + ai,
      })),
  );
  if (items.length === 0) return;
  const { error } = await supabase.from("event_program_items").insert(items);
  if (error) throw error;
}

type DutyAssignmentInput = { deanery: string; parish: string; name: string; youthId?: string | null };
type DutyItemInput = { label: string; assignments: DutyAssignmentInput[] };
type DutyCategoryInput = { name: string; duties: DutyItemInput[] };

async function resolveOrgIdsBulk(deaneryNames: string[], parishNames: string[]) {
  const [deaRes, parRes] = await Promise.all([
    deaneryNames.length
      ? supabase.from("deaneries").select("id, name").in("name", deaneryNames)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    parishNames.length
      ? supabase.from("parishes").select("id, name").in("name", parishNames)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const deaneryMap: Record<string, string> = {};
  (deaRes.data ?? []).forEach((d) => { deaneryMap[d.name] = d.id; });
  const parishMap: Record<string, string> = {};
  (parRes.data ?? []).forEach((p) => { parishMap[p.name] = p.id; });
  return { deaneryMap, parishMap };
}

export async function saveEventDuties(eventId: string, duties: DutyCategoryInput[]): Promise<void> {
  const { data: existingCats } = await supabase
    .from("event_duty_categories")
    .select("id")
    .eq("event_id", eventId);

  if (existingCats && existingCats.length > 0) {
    const catIds = existingCats.map((c) => c.id);
    const { data: existingDuties } = await supabase
      .from("event_duties")
      .select("id")
      .in("category_id", catIds);
    if (existingDuties && existingDuties.length > 0) {
      const dutyIds = existingDuties.map((d) => d.id);
      await supabase.from("event_duty_assignees").delete().in("duty_id", dutyIds);
    }
    await supabase.from("event_duties").delete().in("category_id", catIds);
    await supabase.from("event_duty_categories").delete().eq("event_id", eventId);
  }

  if (duties.length === 0) return;

  const allDeaneries = [...new Set(
    duties.flatMap((c) => c.duties.flatMap((d) => d.assignments.map((a) => a.deanery).filter(Boolean))),
  )];
  const allParishes = [...new Set(
    duties.flatMap((c) => c.duties.flatMap((d) => d.assignments.map((a) => a.parish).filter(Boolean))),
  )];
  const { deaneryMap, parishMap } =
    allDeaneries.length || allParishes.length
      ? await resolveOrgIdsBulk(allDeaneries, allParishes)
      : { deaneryMap: {} as Record<string, string>, parishMap: {} as Record<string, string> };

  for (let ci = 0; ci < duties.length; ci++) {
    const cat = duties[ci];
    const { data: catRow, error: catErr } = await supabase
      .from("event_duty_categories")
      .insert({ event_id: eventId, name: cat.name, position: ci })
      .select("id")
      .single();
    if (catErr) throw catErr;
    if (!catRow) continue;

    for (let di = 0; di < cat.duties.length; di++) {
      const duty = cat.duties[di];
      const { data: dutyRow, error: dutyErr } = await supabase
        .from("event_duties")
        .insert({ category_id: catRow.id, title: duty.label || "Duty", fields: {}, position: di })
        .select("id")
        .single();
      if (dutyErr) throw dutyErr;
      if (!dutyRow) continue;

      const assignees = duty.assignments
        .filter((a) => a.name.trim())
        .map((a) => ({
          duty_id: dutyRow.id,
          name: a.name,
          youth_id: a.youthId ?? null,
          deanery_id: deaneryMap[a.deanery] ?? null,
          parish_id: parishMap[a.parish] ?? null,
        }));
      if (assignees.length > 0) {
        const { error: assErr } = await supabase.from("event_duty_assignees").insert(assignees);
        if (assErr) throw assErr;
      }
    }
  }
}

export async function getEventFull(eventId: string): Promise<EventFull> {
  const [eventRes, programRes, categoriesRes, registrationsRes, checkinRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, event_date, venue, description, poster_url, organization_level, deanery:deaneries(name), parish:parishes(name)")
      .eq("id", eventId)
      .single(),
    supabase
      .from("event_program_items")
      .select("id, activity, start_time, end_time, position")
      .eq("event_id", eventId)
      .order("position"),
    supabase
      .from("event_duty_categories")
      .select(`id, name, position, duties:event_duties(id, title, position, assignees:event_duty_assignees(id, name, youth_id, deanery:deaneries(name), parish:parishes(name)))`)
      .eq("event_id", eventId)
      .order("position"),
    supabase
      .from("event_registrations")
      .select("id, guest_name, guest_phone, guest_email, notes, created_at, youth:youths(cdm_id, full_name, phone, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name))")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("event_checkins")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
  ]);

  if (eventRes.error) throw eventRes.error;

  return {
    ...(eventRes.data as unknown as EventRow),
    program: (programRes.data ?? []) as EventProgramItem[],
    duty_categories: (categoriesRes.data ?? []) as unknown as EventDutyCategory[],
    registrations: (registrationsRes.data ?? []) as unknown as EventRegistration[],
    checkin_count: checkinRes.count ?? 0,
  };
}

export async function deleteEvent(id: string) {
  // Notify everyone registered before the cascade wipes event_registrations.
  const [{ data: event }, { data: registrants }] = await Promise.all([
    supabase.from("events").select("name").eq("id", id).maybeSingle(),
    supabase.from("event_registrations").select("youth_id").eq("event_id", id).not("youth_id", "is", null),
  ]);

  const youthIds = [...new Set((registrants ?? []).map((r) => r.youth_id).filter((v): v is string => !!v))];
  if (youthIds.length > 0 && event?.name) {
    const { data: authLinked } = await supabase.from("youths").select("id, auth_user_id").in("id", youthIds);
    const notifications = (authLinked ?? [])
      .filter((y) => y.auth_user_id)
      .map((y) => ({
        user_id: y.auth_user_id as string,
        category: "event" as const,
        title: "Event cancelled",
        body: `"${event.name}" has been cancelled.`,
      }));
    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }
  }

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

export async function deleteRegistration(registrationId: string) {
  const { error } = await supabase.from("event_registrations").delete().eq("id", registrationId);
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

export async function listEventsPaged(opts: {
  page?: number;
  size?: number;
  q?: string;
  deaneryId?: string | null;
  parishId?: string | null;
  period?: "upcoming" | "done" | null;
}): Promise<{ data: EventRow[]; total: number; page: number; size: number }> {
  const page = opts.page ?? 0;
  const size = Math.min(opts.size ?? 25, 100);
  const today = new Date().toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("events")
    .select(
      "id, name, event_date, venue, description, poster_url, organization_level, deanery:deaneries(name), parish:parishes(name)",
      { count: "exact" },
    )
    .order("event_date", { ascending: opts.period === "upcoming" })
    .range(page * size, page * size + size - 1);

  if (opts.deaneryId) query = query.eq("deanery_id", opts.deaneryId);
  if (opts.parishId)  query = query.eq("parish_id",  opts.parishId);
  if (opts.period === "upcoming") query = query.gte("event_date", today);
  if (opts.period === "done")     query = query.lt("event_date",  today);
  if (opts.q?.trim()) {
    const t = likePattern(opts.q);
    query = query.or(`name.ilike.${t},venue.ilike.${t}`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as unknown as EventRow[], total: count ?? 0, page, size };
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