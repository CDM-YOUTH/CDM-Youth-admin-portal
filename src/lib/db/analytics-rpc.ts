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
  level:     string;
  org_label: string;
  active:    number;
  total:     number;
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

// ── 4. CUSA breakdown ────────────────────────────────────────────────────────

export async function getCusaBreakdown(
  scope: ScopeParams = {},
  groupBy: GroupBy = "deanery",
  institution?: string | null,
): Promise<CusaBreakdownRow[]> {
  const { data, error } = await rpc<unknown[]>("get_cusa_breakdown", {
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

// ── 5. Leader breakdown ──────────────────────────────────────────────────────

export async function getLeaderBreakdown(
  scope: ScopeParams = {},
): Promise<LeaderBreakdownRow[]> {
  const { data, error } = await rpc<unknown[]>("get_leader_breakdown", {
    p_deanery_id:     scope.deaneryId    ?? null,
    p_parish_id:      scope.parishId     ?? null,
    p_outstation_id:  scope.outstationId ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    level:     (r.level as string) ?? "—",
    org_label: (r.org_label as string) ?? "—",
    active:    n(r.active),
    total:     n(r.total),
  }));
}

// ── 6. Welfare breakdown ─────────────────────────────────────────────────────

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

// ── 7. Event breakdown ───────────────────────────────────────────────────────

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
