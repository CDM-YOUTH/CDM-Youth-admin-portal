import { supabase } from "@/integrations/supabase/client";

export type MissionWeek = {
  id: string;
  year: number;
  theme: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "planning" | "nominations" | "pairing" | "execution" | "closed";
};

export type MissionPhase = {
  id: string;
  mission_week_id: string;
  position: number;
  name: string;
  phase_date: string | null;
  status: "upcoming" | "active" | "done";
};

export type MissionNominee = {
  id: string;
  mission_week_id: string;
  youth_id: string;
  source_parish_id: string | null;
  status: "nominated" | "confirmed" | "withdrawn";
  youth?: {
    full_name: string;
    cdm_id: string;
    parish: { name: string; deanery: { name: string } | null } | null;
  } | null;
};

export type MissionPairing = {
  id: string;
  mission_week_id: string;
  youth_id: string;
  host_deanery_id: string | null;
  host_parish_id: string | null;
  status: "pending" | "sent" | "received" | "reported";
  report_summary: string | null;
  report_submitted_at: string | null;
  youth?: { full_name: string; parish: { name: string } | null } | null;
  host_parish?: { name: string; deanery: { name: string } | null } | null;
};

export async function getOrCreateMissionWeek(year?: number): Promise<MissionWeek> {
  const y = year ?? new Date().getFullYear();
  const { data: existing } = await supabase.from("mission_weeks").select("*").eq("year", y).maybeSingle();
  if (existing) return existing as MissionWeek;
  const { data, error } = await supabase
    .from("mission_weeks")
    .insert({ year: y, theme: `Mission Week ${y}`, status: "planning" })
    .select()
    .single();
  if (error) throw error;
  // Seed default phases on creation
  const phases = [
    { name: "Nominations Open", phase_date: "01 Feb – 14 Feb", position: 1, status: "upcoming" as const },
    { name: "Parish Review", phase_date: "15 Feb – 21 Feb", position: 2, status: "upcoming" as const },
    { name: "Cross-Parish Reshuffle", phase_date: "22 Feb – 28 Feb", position: 3, status: "upcoming" as const },
    { name: "Mission Week Execution", phase_date: "01 Mar – 07 Mar", position: 4, status: "upcoming" as const },
    { name: "Reports & Debrief", phase_date: "08 Mar – 15 Mar", position: 5, status: "upcoming" as const },
  ];
  await supabase
    .from("mission_phases")
    .insert(phases.map((p) => ({ ...p, mission_week_id: data.id })));
  return data as MissionWeek;
}

export async function listMissionPhases(missionWeekId: string): Promise<MissionPhase[]> {
  const { data, error } = await supabase
    .from("mission_phases")
    .select("*")
    .eq("mission_week_id", missionWeekId)
    .order("position");
  if (error) throw error;
  return (data ?? []) as MissionPhase[];
}

export async function listMissionNominees(missionWeekId: string): Promise<MissionNominee[]> {
  const { data, error } = await supabase
    .from("mission_nominees")
    .select("*, youth:youths(full_name, cdm_id, parish:parishes(name, deanery:deaneries(name)))")
    .eq("mission_week_id", missionWeekId)
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as unknown as MissionNominee[];
}

export async function listMissionPairings(missionWeekId: string): Promise<MissionPairing[]> {
  const { data, error } = await supabase
    .from("mission_pairings")
    .select(
      "*, youth:youths(full_name, parish:parishes(name)), host_parish:parishes!mission_pairings_host_parish_id_fkey(name, deanery:deaneries(name))",
    )
    .eq("mission_week_id", missionWeekId)
    .limit(2000);
  if (error) {
    // Fallback without explicit fk hint (in case relationship name differs)
    const { data: data2 } = await supabase
      .from("mission_pairings")
      .select("*, youth:youths(full_name, parish:parishes(name)), host_parish:parishes(name, deanery:deaneries(name))")
      .eq("mission_week_id", missionWeekId)
      .limit(2000);
    return (data2 ?? []) as unknown as MissionPairing[];
  }
  return (data ?? []) as unknown as MissionPairing[];
}

export async function nominateYouth(missionWeekId: string, cdmId: string) {
  const { data: y, error: yErr } = await supabase
    .from("youths")
    .select("id, parish_id")
    .eq("cdm_id", cdmId.trim())
    .maybeSingle();
  if (yErr) throw yErr;
  if (!y) throw new Error(`Youth not found: ${cdmId}`);
  const { error } = await supabase.from("mission_nominees").upsert(
    {
      mission_week_id: missionWeekId,
      youth_id: y.id,
      source_parish_id: y.parish_id,
      status: "nominated",
    },
    { onConflict: "mission_week_id,youth_id" },
  );
  if (error) throw error;
}

export async function removeNominee(id: string) {
  const { error } = await supabase.from("mission_nominees").delete().eq("id", id);
  if (error) throw error;
}

export async function setPhaseStatus(id: string, status: MissionPhase["status"]) {
  const { error } = await supabase.from("mission_phases").update({ status }).eq("id", id);
  if (error) throw error;
}

/**
 * Naive reshuffle: assigns each nominee a random host parish that is NOT
 * their source parish. Replaces any existing pairings for the week.
 */
export async function generatePairings(missionWeekId: string): Promise<number> {
  const [{ data: nominees }, { data: parishes }] = await Promise.all([
    supabase
      .from("mission_nominees")
      .select("youth_id, source_parish_id")
      .eq("mission_week_id", missionWeekId),
    supabase.from("parishes").select("id, deanery_id"),
  ]);
  if (!nominees?.length || !parishes?.length) return 0;
  const { error: delErr } = await supabase
    .from("mission_pairings")
    .delete()
    .eq("mission_week_id", missionWeekId);
  if (delErr) throw delErr;
  const rows = nominees.map((n) => {
    const candidates = parishes.filter((p) => p.id !== n.source_parish_id);
    const host = candidates[Math.floor(Math.random() * candidates.length)] ?? parishes[0];
    return {
      mission_week_id: missionWeekId,
      youth_id: n.youth_id,
      host_parish_id: host.id,
      host_deanery_id: host.deanery_id,
      status: "pending" as const,
    };
  });
  const { error } = await supabase.from("mission_pairings").insert(rows);
  if (error) throw error;
  return rows.length;
}

export type MissionAnalytics = {
  nominees: number;
  parishes: number;
  pairs: number;
  reports: number;
};

export async function getMissionAnalytics(missionWeekId: string): Promise<MissionAnalytics> {
  const [n, p, par, r] = await Promise.all([
    supabase.from("mission_nominees").select("id", { count: "exact", head: true }).eq("mission_week_id", missionWeekId),
    supabase.from("parishes").select("id", { count: "exact", head: true }),
    supabase.from("mission_pairings").select("id", { count: "exact", head: true }).eq("mission_week_id", missionWeekId),
    supabase
      .from("mission_pairings")
      .select("id", { count: "exact", head: true })
      .eq("mission_week_id", missionWeekId)
      .not("report_submitted_at", "is", null),
  ]);
  return {
    nominees: n.count ?? 0,
    parishes: p.count ?? 0,
    pairs: par.count ?? 0,
    reports: r.count ?? 0,
  };
}