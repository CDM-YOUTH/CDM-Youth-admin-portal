/**
 * Server-side analytics via Supabase RPC (PostgreSQL functions).
 *
 * All functions pass parameters as typed bind variables — SQL injection
 * is structurally impossible at the database level.
 * NULL scope params mean "no restriction" (diocese-wide).
 */
import { supabase } from "@/integrations/supabase/client";

// ── Shared param types ──────────────────────────────────────────────────────

export type ScopeParams = {
  deaneryId?:    string | null;
  parishId?:     string | null;
  outstationId?: string | null;
};

export type GroupBy = "deanery" | "parish" | "outstation";

// ── Return types ────────────────────────────────────────────────────────────

export type AnalyticsSummary = {
  total_youths:        number;
  active_youths:       number;
  enrolled:            number;
  pending_enrollments: number;
  cusa_members:        number;
  cusa_active:         number;
  active_leaders:      number;
  upcoming_events:     number;
  welfare_open:        number;
  welfare_urgent:      number;
};

export type YouthBreakdownRow = {
  id:            string | null;
  label:         string;
  deanery_id:    string | null;
  deanery_name:  string | null;
  parish_id:     string | null;
  parish_name:   string | null;
  total:         number;
  active:        number;
  male:          number;
  female:        number;
  cat_primary:   number;
  cat_secondary: number;
  cat_tertiary:  number;
  cat_working:   number;
};

export type EnrollmentBreakdownRow = {
  id:           string | null;
  label:        string;
  deanery_id:   string | null;
  deanery_name: string | null;
  parish_id:    string | null;
  parish_name:  string | null;
  total_youths: number;
  enrolled:     number;
  paid:         number;
  pending:      number;
  waived:       number;
};

export type EnrollmentTrendRow = {
  year: number;
  enrolled: number;
  paid: number;
  pending: number;
  waived: number;
};

export type EnrollmentDemographicsRow = {
  enrolled: number;
  paid: number;
  pending: number;
  waived: number;
  male: number;
  female: number;
  cat_primary: number;
  cat_secondary: number;
  cat_tertiary: number;
  cat_working: number;
  cat_other: number;
};

export type CusaBreakdownRow = {
  id:           string | null;
  label:        string;
  deanery_id:   string | null;
  deanery_name: string | null;
  parish_id:    string | null;
  parish_name:  string | null;
  total:        number;
  with_role:    number;
  male:         number;
  female:       number;
};

export type LeaderBreakdownRow = {
  id:               string | null;
  label:            string;
  deanery_id:       string | null;
  deanery_name:     string | null;
  parish_id:        string | null;
  parish_name:      string | null;
  diocese_active:   number;
  deanery_active:   number;
  parish_active:    number;
  outstation_active: number;
  total_active:     number;
};

export type WelfareBreakdownRow = {
  parish_id:   string | null;
  parish_name: string;
  open:        number;
  in_progress: number;
  resolved:    number;
  closed:      number;
  urgent:      number;
  total:       number;
};

export type EventBreakdownRow = {
  org_id:         string | null;
  org_label:      string;
  level:          string;
  total_events:   number;
  upcoming:       number;
  completed:      number;
  total_checkins: number;
};

export type AgeRangeRow = { label: string; count: number };

// ── Helper ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function n(v: unknown): number { return Number(v ?? 0); }

function rpc<T>(name: string, params: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, params) as Promise<{ data: T | null; error: { message: string } | null }>;
}

// ── 1. Summary KPIs ─────────────────────────────────────────────────────────

export async function getAnalyticsSummary(
  year: number,
  scope: ScopeParams = {},
): Promise<AnalyticsSummary> {
  const { data, error } = await rpc<AnalyticsSummary[]>("get_analytics_summary", {
    p_year:           year,
    p_deanery_id:     scope.deaneryId    ?? null,
    p_parish_id:      scope.parishId     ?? null,
    p_outstation_id:  scope.outstationId ?? null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    total_youths:        n(row?.total_youths),
    active_youths:       n(row?.active_youths),
    enrolled:            n(row?.enrolled),
    pending_enrollments: n(row?.pending_enrollments),
    cusa_members:        n(row?.cusa_members),
    cusa_active:         n(row?.cusa_active),
    active_leaders:      n(row?.active_leaders),
    upcoming_events:     n(row?.upcoming_events),
    welfare_open:        n(row?.welfare_open),
    welfare_urgent:      n(row?.welfare_urgent),
  };
}

// ── 2. Youth breakdown ───────────────────────────────────────────────────────

export async function getYouthBreakdown(
  scope: ScopeParams = {},
  groupBy: GroupBy = "deanery",
): Promise<YouthBreakdownRow[]> {
  const { data, error } = await rpc<unknown[]>("get_youth_breakdown", {
    p_deanery_id:     scope.deaneryId    ?? null,
    p_parish_id:      scope.parishId     ?? null,
    p_outstation_id:  scope.outstationId ?? null,
    p_group_by:       groupBy,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id:            (r.id as string | null) ?? null,
    label:         (r.label as string) ?? "—",
    deanery_id:    (r.deanery_id as string | null) ?? null,
    deanery_name:  (r.deanery_name as string | null) ?? null,
    parish_id:     (r.parish_id as string | null) ?? null,
    parish_name:   (r.parish_name as string | null) ?? null,
    total:         n(r.total),
    active:        n(r.active),
    male:          n(r.male),
    female:        n(r.female),
    cat_primary:   n(r.cat_primary),
    cat_secondary: n(r.cat_secondary),
    cat_tertiary:  n(r.cat_tertiary),
    cat_working:   n(r.cat_working),
  }));
}

// ── 3. Enrollment breakdown ──────────────────────────────────────────────────

export async function getEnrollmentBreakdown(
  year: number,
  scope: ScopeParams = {},
  groupBy: GroupBy = "deanery",
): Promise<EnrollmentBreakdownRow[]> {
  const { data, error } = await rpc<unknown[]>("get_enrollment_breakdown", {
    p_year:           year,
    p_deanery_id:     scope.deaneryId    ?? null,
    p_parish_id:      scope.parishId     ?? null,
    p_outstation_id:  scope.outstationId ?? null,
    p_group_by:       groupBy,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id:           (r.id as string | null) ?? null,
    label:        (r.label as string) ?? "—",
    deanery_id:   (r.deanery_id as string | null) ?? null,
    deanery_name: (r.deanery_name as string | null) ?? null,
    parish_id:    (r.parish_id as string | null) ?? null,
    parish_name:  (r.parish_name as string | null) ?? null,
    total_youths: n(r.total_youths),
    enrolled:     n(r.enrolled),
    paid:         n(r.paid),
    pending:      n(r.pending),
    waived:       n(r.waived),
  }));
}

// ── 4. Enrollment trend ──────────────────────────────────────────────────────

export async function getEnrollmentTrend(
  year: number,
  scope: ScopeParams = {},
  yearsBack = 5,
): Promise<EnrollmentTrendRow[]> {
  const { data, error } = await rpc<unknown[]>("get_enrollment_trend", {
    p_year:           year,
    p_years_back:     yearsBack,
    p_deanery_id:     scope.deaneryId    ?? null,
    p_parish_id:      scope.parishId     ?? null,
    p_outstation_id:  scope.outstationId ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    year:     Number(r.year ?? 0),
    enrolled: n(r.enrolled),
    paid:     n(r.paid),
    pending:  n(r.pending),
    waived:   n(r.waived),
  }));
}

// ── 5. Enrollment demographics ──────────────────────────────────────────────

export async function getEnrollmentDemographics(
  year: number,
  scope: ScopeParams = {},
): Promise<EnrollmentDemographicsRow> {
  const { data, error } = await rpc<unknown[]>("get_enrollment_demographics", {
    p_year:           year,
    p_deanery_id:     scope.deaneryId    ?? null,
    p_parish_id:      scope.parishId     ?? null,
    p_outstation_id:  scope.outstationId ?? null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | null);
  return {
    enrolled:  n(row?.enrolled),
    paid:      n(row?.paid),
    pending:   n(row?.pending),
    waived:    n(row?.waived),
    male:      n(row?.male),
    female:    n(row?.female),
    cat_primary: n(row?.cat_primary),
    cat_secondary: n(row?.cat_secondary),
    cat_tertiary: n(row?.cat_tertiary),
    cat_working: n(row?.cat_working),
    cat_other: n(row?.cat_other),
  };
}

// ── 6. CUSA breakdown ────────────────────────────────────────────────────────

export async function getCusaBreakdown(
  year: number,
  scope: ScopeParams = {},
  groupBy: GroupBy = "deanery",
  institution?: string | null,
): Promise<CusaBreakdownRow[]> {
  const { data, error } = await rpc<unknown[]>("get_cusa_breakdown", {
    p_year:           year,
    p_deanery_id:     scope.deaneryId    ?? null,
    p_parish_id:      scope.parishId     ?? null,
    p_outstation_id:  scope.outstationId ?? null,
    p_group_by:       groupBy,
    p_institution:    institution        ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id:           (r.id as string | null) ?? null,
    label:        (r.label as string) ?? "—",
    deanery_id:   (r.deanery_id as string | null) ?? null,
    deanery_name: (r.deanery_name as string | null) ?? null,
    parish_id:    (r.parish_id as string | null) ?? null,
    parish_name:  (r.parish_name as string | null) ?? null,
    total:        n(r.total),
    with_role:    n(r.with_role),
    male:         n(r.male),
    female:       n(r.female),
  }));
}

// ── 7. Leader breakdown ──────────────────────────────────────────────────────

export async function getLeaderBreakdown(
  scope: ScopeParams = {},
  groupBy: GroupBy = "deanery",
): Promise<LeaderBreakdownRow[]> {
  const { data, error } = await rpc<unknown[]>("get_leader_breakdown", {
    p_deanery_id:     scope.deaneryId    ?? null,
    p_parish_id:      scope.parishId     ?? null,
    p_outstation_id:  scope.outstationId ?? null,
    p_group_by:       groupBy,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id:               (r.id as string | null) ?? null,
    label:            (r.label as string) ?? "—",
    deanery_id:       (r.deanery_id as string | null) ?? null,
    deanery_name:     (r.deanery_name as string | null) ?? null,
    parish_id:        (r.parish_id as string | null) ?? null,
    parish_name:      (r.parish_name as string | null) ?? null,
    diocese_active:   n(r.diocese_active),
    deanery_active:   n(r.deanery_active),
    parish_active:    n(r.parish_active),
    outstation_active: n(r.outstation_active),
    total_active:     n(r.total_active),
  }));
}

// ── 8. Welfare breakdown ─────────────────────────────────────────────────────

export async function getWelfareBreakdown(
  scope: ScopeParams = {},
): Promise<WelfareBreakdownRow[]> {
  const { data, error } = await rpc<unknown[]>("get_welfare_breakdown", {
    p_parish_id: scope.parishId ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    parish_id:   (r.parish_id as string | null) ?? null,
    parish_name: (r.parish_name as string) ?? "—",
    open:        n(r.open),
    in_progress: n(r.in_progress),
    resolved:    n(r.resolved),
    closed:      n(r.closed),
    urgent:      n(r.urgent),
    total:       n(r.total),
  }));
}

// ── 9. Event breakdown ───────────────────────────────────────────────────────

export async function getEventBreakdown(
  scope: ScopeParams = {},
  opts: { fromDate?: string; toDate?: string } = {},
): Promise<EventBreakdownRow[]> {
  const { data, error } = await rpc<unknown[]>("get_event_breakdown", {
    p_deanery_id: scope.deaneryId ?? null,
    p_parish_id:  scope.parishId  ?? null,
    p_from_date:  opts.fromDate   ?? null,
    p_to_date:    opts.toDate     ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    org_id:         (r.org_id as string | null) ?? null,
    org_label:      (r.org_label as string) ?? "—",
    level:          (r.level as string) ?? "—",
    total_events:   n(r.total_events),
    upcoming:       n(r.upcoming),
    completed:      n(r.completed),
    total_checkins: n(r.total_checkins),
  }));
}

// ── 10. Age-range breakdown ──────────────────────────────────────────────────

// Three canonical display buckets. All stored age_range strings (e.g. "18-21",
// "21-24", "25-27", "27-30", "30-35") are harmonised to these at query time by
// extracting the lower bound of the stored range and re-bucketing.
const AGE_BUCKETS = [
  { label: "Below 18", test: (n: number) => n < 18 },
  { label: "18-24",    test: (n: number) => n >= 18 && n <= 24 },
  { label: "25-30",    test: (n: number) => n >= 25 },
] as const;

function resolveAgeBucket(age: number | null, ageRange: string | null): string | null {
  // Prefer age_range: extract the first number (lower bound) and re-bucket
  if (ageRange) {
    const m = String(ageRange).match(/\d+/);
    if (m) {
      const lower = parseInt(m[0], 10);
      return AGE_BUCKETS.find((b) => b.test(lower))?.label ?? null;
    }
  }
  if (age != null && age > 0) {
    return AGE_BUCKETS.find((b) => b.test(age))?.label ?? null;
  }
  return null;
}

export async function getAgeRangeBreakdown(scope: ScopeParams = {}): Promise<AgeRangeRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any).from("youths").select("age, age_range");
  if (scope.deaneryId)    q = q.eq("deanery_id", scope.deaneryId);
  if (scope.parishId)     q = q.eq("parish_id", scope.parishId);
  if (scope.outstationId) q = q.eq("outstation_id", scope.outstationId);
  const { data } = await q;
  const rows = (data ?? []) as { age: number | null; age_range: string | null }[];

  const buckets: Record<string, number> = {};
  for (const r of rows) {
    const label = resolveAgeBucket(r.age, r.age_range);
    if (label) buckets[label] = (buckets[label] ?? 0) + 1;
  }

  return AGE_BUCKETS
    .map(({ label }) => ({ label, count: buckets[label] ?? 0 }))
    .filter((r) => r.count > 0);
}
