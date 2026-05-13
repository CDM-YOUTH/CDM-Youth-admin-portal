import { supabase } from "@/integrations/supabase/client";
import { ORGANIZATION, type AnalyticsUnit } from "@/lib/mock-data";

export type DashboardCounts = {
  youths: number;
  enrolled: number;
  cusaMembers: number;
  cusaActive: number;
};

export async function getDashboardCounts(year?: number): Promise<DashboardCounts> {
  const y = year ?? new Date().getFullYear();
  const [youthsRes, enrolledRes, cusaRes, cusaActiveRes] = await Promise.all([
    supabase.from("youths").select("id", { count: "exact", head: true }),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("year", y),
    supabase.from("cusa_members").select("id", { count: "exact", head: true }),
    supabase
      .from("cusa_members")
      .select("id", { count: "exact", head: true })
      .not("leadership_role", "is", null),
  ]);
  return {
    youths: youthsRes.count ?? 0,
    enrolled: enrolledRes.count ?? 0,
    cusaMembers: cusaRes.count ?? 0,
    cusaActive: cusaActiveRes.count ?? 0,
  };
}

export type LiveAnalytics = {
  units: AnalyticsUnit[];
  upcomingEvents: { id: string; name: string; venue: string; parish: string; day: string; month: string; registered: number }[];
};

/**
 * Build dashboard analytics from the live database. The unit array reuses
 * the ORGANIZATION shape (so existing filter dropdowns keep working), but
 * counts (youths/enrolled/cusa/categories) are computed from real rows. We
 * match by deanery + parish + outstation names. Mission week fields default
 * to 0 because no mission tables exist yet.
 */
export async function getLiveAnalytics(year?: number): Promise<LiveAnalytics> {
  const y = year ?? new Date().getFullYear();
  const [youthsRes, enrolledRes, cusaRes, eventsRes] = await Promise.all([
    supabase
      .from("youths")
      .select("id, gender, category, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name)")
      .limit(10000),
    supabase
      .from("enrollments")
      .select("id, youth:youths(id, gender, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name))")
      .eq("year", y)
      .limit(10000),
    supabase
      .from("cusa_members")
      .select("id, leadership_role, institution, youth:youths(gender, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name))")
      .limit(10000),
    supabase
      .from("events")
      .select("id, name, event_date, venue, parish:parishes(name), deanery:deaneries(name)")
      .gte("event_date", new Date().toISOString().slice(0, 10))
      .order("event_date", { ascending: true })
      .limit(20),
  ]);

  type Counts = {
    youths: number;
    enrolled: number;
    cusaMembers: number;
    cusaActive: number;
    primary: number;
    secondary: number;
    tertiary: number;
    working: number;
  };
  const empty: Counts = {
    youths: 0,
    enrolled: 0,
    cusaMembers: 0,
    cusaActive: 0,
    primary: 0,
    secondary: 0,
    tertiary: 0,
    working: 0,
  };

  // key = "deaneryName|parishName|outstationName" (outstation may be empty)
  const buckets = new Map<string, Counts>();
  const bump = (key: string, patch: Partial<Counts>) => {
    const c = buckets.get(key) ?? { ...empty };
    for (const k of Object.keys(patch) as (keyof Counts)[]) {
      c[k] = (c[k] ?? 0) + (patch[k] ?? 0);
    }
    buckets.set(key, c);
  };
  const k = (d?: string | null, p?: string | null, o?: string | null) =>
    `${d ?? ""}|${p ?? ""}|${o ?? ""}`;

  type YouthBucket = {
    deanery: { name: string } | null;
    parish: { name: string } | null;
    outstation: { name: string } | null;
  };
  for (const y of (youthsRes.data ?? []) as Array<YouthBucket & { category: string | null }>) {
    const key = k(y.deanery?.name, y.parish?.name, y.outstation?.name);
    const cat = (y.category ?? "Secondary").toLowerCase() as "primary" | "secondary" | "tertiary" | "working";
    bump(key, { youths: 1, [cat]: 1 } as Partial<Counts>);
  }
  for (const e of (enrolledRes.data ?? []) as Array<{ youth: YouthBucket | null }>) {
    const yo = e.youth;
    if (!yo) continue;
    bump(k(yo.deanery?.name, yo.parish?.name, yo.outstation?.name), { enrolled: 1 });
  }
  for (const c of (cusaRes.data ?? []) as Array<{ leadership_role: string | null; youth: YouthBucket | null }>) {
    const yo = c.youth;
    if (!yo) continue;
    bump(k(yo.deanery?.name, yo.parish?.name, yo.outstation?.name), {
      cusaMembers: 1,
      cusaActive: c.leadership_role ? 1 : 0,
    });
  }

  // Now fold buckets onto ORGANIZATION units. Outstation match preferred;
  // fall back to parish-level rollup if outstation is missing.
  const units: AnalyticsUnit[] = ORGANIZATION.flatMap((deanery) =>
    deanery.parishes.flatMap((parish) =>
      parish.churches.map((church) => {
        const exact = buckets.get(k(deanery.name, parish.name, church.name)) ?? empty;
        // Spread parish-level (no outstation) counts only across the FIRST
        // outstation, so totals don't double-count when youths lack outstation.
        const isFirst = parish.churches[0]?.id === church.id;
        const orphan = isFirst ? buckets.get(k(deanery.name, parish.name, "")) ?? empty : empty;
        const totals: Counts = {
          youths: exact.youths + orphan.youths,
          enrolled: exact.enrolled + orphan.enrolled,
          cusaMembers: exact.cusaMembers + orphan.cusaMembers,
          cusaActive: exact.cusaActive + orphan.cusaActive,
          primary: exact.primary + orphan.primary,
          secondary: exact.secondary + orphan.secondary,
          tertiary: exact.tertiary + orphan.tertiary,
          working: exact.working + orphan.working,
        };
        return {
          ...church,
          deaneryCode: deanery.code,
          deaneryName: deanery.name,
          parishId: parish.id,
          parishName: parish.name,
          youths: totals.youths,
          enrolled: totals.enrolled,
          cusaMembers: totals.cusaMembers,
          cusaActive: totals.cusaActive,
          missionNominees: 0,
          missionPairs: 0,
          missionReports: 0,
          categories: {
            primary: totals.primary,
            secondary: totals.secondary,
            tertiary: totals.tertiary,
            working: totals.working,
          },
        };
      }),
    ),
  );

  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const upcomingEvents = ((eventsRes.data ?? []) as Array<{
    id: string;
    name: string;
    event_date: string | null;
    venue: string | null;
    parish: { name: string } | null;
    deanery: { name: string } | null;
  }>).map((e) => {
    const d = e.event_date ? new Date(e.event_date) : null;
    return {
      id: e.id,
      name: e.name,
      venue: e.venue ?? "",
      parish: e.parish?.name ?? e.deanery?.name ?? "Diocese-wide",
      day: d ? String(d.getDate()).padStart(2, "0") : "—",
      month: d ? months[d.getMonth()] : "—",
      registered: 0,
    };
  });

  return { units, upcomingEvents };
}
