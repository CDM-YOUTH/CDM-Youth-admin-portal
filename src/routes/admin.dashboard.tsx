import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Topbar,
  TopbarTab,
  TopbarButton,
} from "@/components/admin/layout/topbar";
import {
  Card,
  CardBody,
  CardHead,
  FilterBar,
  FilterDivider,
  FilterLabel,
  FilterScope,
  Kpi,
  Pill,
  ProgressRow,
} from "@/components/admin/composables/ui-bits";
import { Donut } from "@/components/admin/composables/donut";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CUSA_INSTITUTIONS } from "@/lib/cusa-data";
import { getLiveAnalytics } from "@/lib/db/analytics";
import {
  getAnalyticsSummary,
  getYouthBreakdown,
  getEnrollmentBreakdown,
  getEnrollmentDemographics,
  getEnrollmentTrend,
  getCusaBreakdown,
  getLeaderBreakdown,
  getAgeRangeBreakdown,
  type GroupBy,
  type LeaderBreakdownRow,
} from "@/lib/db/analytics-rpc";
import { fetchOrg } from "@/lib/db/org";
import { useAdminScope } from "@/lib/hooks/use-admin-scope";
import {
  ANALYTICS_UNITS,
  ORGANIZATION,
  TOP_PARISHES,
  type AnalyticsUnit,
} from "@/lib/mock-data";
import { listDashboardEvents, type EventRow } from "@/lib/db/activities/events";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CDM Youth Office" },
      {
        name: "description",
        content:
          "Diocese-wide overview of youth enrollment, events, mission week, CUSA, and welfare across the Catholic Diocese of Murang'a.",
      },
    ],
  }),
  component: DashboardPage,
});

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => CURRENT_YEAR - i);

type Tab = "general" | "leaders" | "enrollment" | "cusa" | "mission";
type FilterState = { deaneryCode: string; parishId: string; churchId: string };
type ChartDisplay = "count" | "percent";

const emptyFilters: FilterState = { deaneryCode: "", parishId: "", churchId: "" };

type RpcFilters = { deaneryId: string; parishId: string; outstationId: string };
const emptyRpcFilters: RpcFilters = { deaneryId: "", parishId: "", outstationId: "" };

function DashboardPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [chartDisplay, setChartDisplay] = useState<ChartDisplay>("count");

  return (
    <>
      <Topbar
        title="Dashboard"
        tabs={
          <>
          <TopbarTab active={tab === "general"} onClick={() => setTab("general")}>
              General
            </TopbarTab>
            <TopbarTab active={tab === "leaders"} onClick={() => setTab("leaders")}>
              Leaders
            </TopbarTab>
            <TopbarTab active={tab === "enrollment"} onClick={() => setTab("enrollment")}>
              Enrollment
            </TopbarTab>
            <TopbarTab active={tab === "cusa"} onClick={() => setTab("cusa")}>
              CUSA
            </TopbarTab>
            <TopbarTab active={tab === "mission"} onClick={() => setTab("mission")}>
              Mission Week
            </TopbarTab>
          </>
        }
        action={
          <>
            <ChartDisplayToggle value={chartDisplay} onChange={setChartDisplay} />
            <TopbarButton>Export Report</TopbarButton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === "general" && <GeneralTab chartDisplay={chartDisplay} />}
        {tab === "leaders" && <LeadersTab chartDisplay={chartDisplay} />}
        {tab === "enrollment" && <EnrollmentTab chartDisplay={chartDisplay} />}
        {tab === "cusa" && <CusaTab chartDisplay={chartDisplay} />}
        {tab === "mission" && <MissionTab chartDisplay={chartDisplay} />}
      </div>
    </>
  );
}

function useFilteredAnalytics(year?: number) {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const { data: live } = useQuery({
    queryKey: ["live-analytics", year ?? CURRENT_YEAR],
    queryFn: () => getLiveAnalytics(year),
    staleTime: 30_000,
  });
  const sourceUnits = live?.units ?? ANALYTICS_UNITS;
  const selectedDeanery = ORGANIZATION.find((d) => d.code === filters.deaneryCode);
  const selectedParish = selectedDeanery?.parishes.find((p) => p.id === filters.parishId);
  const units = useMemo(
    () =>
      sourceUnits.filter((unit) => {
        if (filters.deaneryCode && unit.deaneryCode !== filters.deaneryCode) return false;
        if (filters.parishId && unit.parishId !== filters.parishId) return false;
        if (filters.churchId && unit.id !== filters.churchId) return false;
        return true;
      }),
    [filters, sourceUnits],
  );

  const scope = filters.churchId
    ? selectedParish?.churches.find((church) => church.id === filters.churchId)?.name
    : selectedParish?.name ?? selectedDeanery?.name ?? "Diocese-wide";

  return {
    filters,
    setFilters,
    selectedDeanery,
    selectedParish,
    units,
    scope: scope ?? "Diocese-wide",
    upcomingEvents: live?.upcomingEvents ?? null,
    pendingEnrollments: live?.pendingEnrollments ?? 0,
  };
}

// Shared hook for tabs backed by the server-side analytics RPCs.
// Replaces the old useFilteredAnalytics / ORGANIZATION static-data approach.
function useRpcFilters() {
  const adminScope = useAdminScope();
  const [filters, setFilters] = useState<RpcFilters>(emptyRpcFilters);
  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg, staleTime: 300_000 });

  const effectiveDeaneryId    = adminScope.deaneryId || filters.deaneryId    || null;
  const effectiveParishId     = adminScope.parishId  || filters.parishId     || null;
  const effectiveOutstationId = filters.outstationId || null;

  const deaneryOptions    = (org?.deaneries ?? []).map((d) => ({ value: d.id, label: d.name }));
  const parishOptions     = (org?.parishes  ?? [])
    .filter((p) => !effectiveDeaneryId || p.deanery_id === effectiveDeaneryId)
    .map((p) => ({ value: p.id, label: p.name }));
  const outstationOptions = (org?.outstations ?? [])
    .filter((o) => !effectiveParishId || o.parish_id === effectiveParishId)
    .map((o) => ({ value: o.id, label: o.name }));

  const scopeLabel = effectiveParishId
    ? (org?.parishes.find((p) => p.id === effectiveParishId)?.name ?? "Parish")
    : effectiveDeaneryId
    ? (org?.deaneries.find((d) => d.id === effectiveDeaneryId)?.name ?? "Deanery")
    : "Diocese-wide";

  const scopeParams = {
    deaneryId:    effectiveDeaneryId,
    parishId:     effectiveParishId,
    outstationId: effectiveOutstationId,
  };

  const groupBy: GroupBy = effectiveParishId ? "outstation" : effectiveDeaneryId ? "parish" : "deanery";
  const hasFilter = !!(filters.deaneryId || filters.parishId || filters.outstationId);
  function clearFilters() { setFilters(emptyRpcFilters); }

  return {
    adminScope, filters, setFilters,
    deaneryOptions, parishOptions, outstationOptions,
    scopeLabel, scopeParams, hasFilter, clearFilters, groupBy,
    effectiveDeaneryId, effectiveParishId, effectiveOutstationId,
  };
}

function totalsFor(units: AnalyticsUnit[]) {
  return units.reduce(
    (acc, unit) => ({
      youths: acc.youths + unit.youths,
      enrolled: acc.enrolled + unit.enrolled,
      cusaMembers: acc.cusaMembers + unit.cusaMembers,
      cusaActive: acc.cusaActive + unit.cusaActive,
      missionNominees: acc.missionNominees + unit.missionNominees,
      missionPairs: acc.missionPairs + unit.missionPairs,
      missionReports: acc.missionReports + unit.missionReports,
      primary: acc.primary + unit.categories.primary,
      secondary: acc.secondary + unit.categories.secondary,
      tertiary: acc.tertiary + unit.categories.tertiary,
      working: acc.working + unit.categories.working,
    }),
    {
      youths: 0,
      enrolled: 0,
      cusaMembers: 0,
      cusaActive: 0,
      missionNominees: 0,
      missionPairs: 0,
      missionReports: 0,
      primary: 0,
      secondary: 0,
      tertiary: 0,
      working: 0,
    },
  );
}

function rollupRows(
  units: AnalyticsUnit[],
  filters: FilterState,
  valueKey: "enrolled" | "cusaMembers" | "cusaActive" | "missionNominees" | "missionReports",
  maxKey: "youths" | "cusaMembers" | "missionPairs" | "missionNominees",
) {
  const groups = new Map<string, { label: string; value: number; max: number }>();
  units.forEach((unit) => {
    const key = filters.parishId ? unit.id : filters.deaneryCode ? unit.parishId : unit.deaneryCode;
    const label = filters.parishId ? unit.name : filters.deaneryCode ? unit.parishName : unit.deaneryName;
    const row = groups.get(key) ?? { label, value: 0, max: 0 };
    row.value += unit[valueKey];
    row.max += unit[maxKey];
    groups.set(key, row);
  });
  return [...groups.values()].sort((a, b) => b.value - a.value);
}


function pct(value: number, max: number) {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}

function ChartDisplayToggle({ value, onChange }: { value: ChartDisplay; onChange: (value: ChartDisplay) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-bg-3 p-0.5">
      {(["count", "percent"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`rounded px-2 py-0.5 text-[9px] font-bold transition ${
            value === mode ? "bg-danger text-white" : "text-text-3 hover:text-danger"
          }`}
        >
          {mode === "count" ? "No." : "%"}
        </button>
      ))}
    </div>
  );
}

function genderRows(units: AnalyticsUnit[], metric: "enrolled" | "missionNominees") {
  const total = units.reduce((sum, unit) => sum + unit[metric], 0);
  const female = units.reduce((sum, unit) => sum + Math.round(unit[metric] * (0.46 + (unit.youths % 13) / 100)), 0);
  return [
    { label: "Female", value: Math.min(female, total), color: "var(--color-pink)" },
    { label: "Male", value: Math.max(0, total - female), color: "var(--color-info)" },
  ];
}


/* ---------- TAB: General ---------- */

function GeneralTab({ chartDisplay }: { chartDisplay: ChartDisplay }) {
  const rpc = useRpcFilters();
  const { scopeParams, groupBy } = rpc;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics-summary", CURRENT_YEAR, scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId],
    queryFn: () => getAnalyticsSummary(CURRENT_YEAR, scopeParams),
    staleTime: 30_000,
    refetchOnMount: "always",
  });
  const { data: youthBreakdown = [] } = useQuery({
    queryKey: ["youth-breakdown", scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId, groupBy],
    queryFn: () => getYouthBreakdown(scopeParams, groupBy),
    staleTime: 30_000,
  });
  const { data: enrollBreakdown = [] } = useQuery({
    queryKey: ["enrollment-breakdown", CURRENT_YEAR, scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId, groupBy],
    queryFn: () => getEnrollmentBreakdown(CURRENT_YEAR, scopeParams, groupBy),
    staleTime: 30_000,
  });
  const { data: ageRangeData = [] } = useQuery({
    queryKey: ["age-range-breakdown", scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId],
    queryFn: () => getAgeRangeBreakdown(scopeParams),
    staleTime: 30_000,
  });
  const { data: dashboardEvents = [] } = useQuery({
    queryKey: ["dashboard-events"],
    queryFn: () => listDashboardEvents(4),
    staleTime: 60_000,
  });

  const totalYouths   = summary?.total_youths ?? 0;
  const totalEnrolled = summary?.enrolled ?? 0;
  const upcomingCount = summary?.upcoming_events ?? 0;
  const maxYouths     = Math.max(...enrollBreakdown.map((r) => r.total_youths), 1);

  const catTotals = youthBreakdown.reduce(
    (acc, r) => ({
      primary: acc.primary + r.cat_primary, secondary: acc.secondary + r.cat_secondary,
      tertiary: acc.tertiary + r.cat_tertiary, working: acc.working + r.cat_working,
    }),
    { primary: 0, secondary: 0, tertiary: 0, working: 0 },
  );
  const categoryData = [
    { label: "Primary",         value: catTotals.primary,   color: "var(--color-info)" },
    { label: "Secondary",       value: catTotals.secondary, color: "var(--color-success)" },
    { label: "Tertiary / CUSA", value: catTotals.tertiary,  color: "var(--color-violet)" },
    { label: "Working Youth",   value: catTotals.working,   color: "var(--color-gold)" },
  ].filter((d) => d.value > 0);

  const totalMale   = youthBreakdown.reduce((s, r) => s + r.male, 0);
  const totalFemale = youthBreakdown.reduce((s, r) => s + r.female, 0);
  const genderTotal = (totalMale + totalFemale) || 1;

  const topParishes = [...enrollBreakdown].sort((a, b) => b.enrolled - a.enrolled).slice(0, 4);

  return (
    <>
      <RpcFilterBar rpc={rpc} />

      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total Youths"    value={summaryLoading ? "—" : totalYouths.toLocaleString()}                               trend="selected scope"               tone="info" sub={rpc.scopeLabel} />
        <Kpi label="Enrolled"        value={summaryLoading ? "—" : totalEnrolled.toLocaleString()}                             trend={summaryLoading ? "loading…" : `${pct(totalEnrolled, totalYouths)}% of registered`} tone="up" />
        <Kpi label="CUSA Members"    value={summaryLoading ? "—" : (summary?.cusa_members ?? 0).toLocaleString()}              trend={summaryLoading ? "loading…" : `${summary?.cusa_active ?? 0} active`}              tone="up" />
        <Kpi label="Active Leaders"  value={summaryLoading ? "—" : (summary?.active_leaders ?? 0).toLocaleString()}            trend="in current term"              tone="info" />
        <Kpi label="Upcoming Events" value={summaryLoading ? "—" : upcomingCount.toLocaleString()}                             trend="next 30 days"                 tone="info" sub="diocese-wide" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHead title="Enrollment Analytics" subtitle="Changes with deanery, parish, and outstation filters" />
            <CardBody>
              {enrollBreakdown.slice(0, 8).map((d) => (
                <ProgressRow key={d.label} label={d.label} value={d.enrolled} max={maxYouths} color="var(--color-success)" display={chartDisplay} />
              ))}
              {enrollBreakdown.length === 0 && (
                <p className="py-4 text-center text-[11px] text-text-2">No data for selected filters.</p>
              )}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card>
              <CardHead title="By Category" />
              <CardBody>
                <Donut data={categoryData.length > 0 ? categoryData : [{ label: "No data", value: 1, color: "var(--color-border)" }]} display={chartDisplay} />
              </CardBody>
            </Card>
            <Card>
              <CardHead title="Gender Split" />
              <CardBody>
                <ProgressRow label="Male"   value={totalMale}   max={genderTotal} color="var(--color-info)"  display={chartDisplay} />
                <ProgressRow label="Female" value={totalFemale} max={genderTotal} color="var(--color-pink)"  display={chartDisplay} />
                <div className="my-2 h-px bg-border" />
                <div className="label-eyebrow mb-2">Top Parishes</div>
                {topParishes.map((p) => (
                  <div key={p.label} className="flex items-center justify-between border-b border-border/50 py-1 text-[10px] last:border-0">
                    <span className="text-text-1">{p.label}</span>
                    <span className="font-bold text-danger">{p.enrolled}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Card>
            <CardHead title="Age Range" subtitle="Registered youths by age group" />
            <CardBody>
              <Donut
                data={
                  ageRangeData.length > 0
                    ? ageRangeData.map((r, i) => ({
                        label: r.label,
                        value: r.count,
                        color: ["var(--color-info)", "var(--color-success)", "var(--color-violet)"][i % 3],
                      }))
                    : [{ label: "No data", value: 1, color: "var(--color-border)" }]
                }
                display={chartDisplay}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Upcoming Events" action="View all →" />
            <CardBody className="space-y-2">
              {upcomingCount > 0 && (
                <div className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-center text-[10px] text-text-1">
                  {upcomingCount} event{upcomingCount !== 1 ? "s" : ""} coming up — <a href="/admin/events" className="text-danger hover:underline">view all →</a>
                </div>
              )}
              {dashboardEvents.map((e: EventRow) => {
                const d = e.event_date ? new Date(e.event_date) : null;
                const month = d ? d.toLocaleString("en-GB", { month: "short" }) : "—";
                const day = d ? String(d.getDate()).padStart(2, "0") : "—";
                const location = e.parish?.name ?? e.deanery?.name ?? e.venue ?? "Diocese";
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-2.5">
                    <div className="min-w-[44px] shrink-0 rounded-md bg-bg-4 px-2 py-1.5 text-center">
                      <div className="text-[7px] font-bold uppercase tracking-wide text-gold">{month}</div>
                      <div className="text-[18px] font-black leading-none text-foreground">{day}</div>
                    </div>
                    <div className="flex-1 leading-tight">
                      <div className="text-[11px] font-semibold text-text-1">{e.name}</div>
                      <div className="text-[9px] text-text-3">{location}</div>
                    </div>
                  </div>
                );
              })}
              {dashboardEvents.length === 0 && (
                <div className="rounded-lg border border-dashed border-border bg-bg-2 p-3 text-center text-[10px] text-text-3">No upcoming events scheduled.</div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function OrgFilterBar({
  filters,
  setFilters,
  selectedDeanery,
  selectedParish,
  scope,
  institution,
  onInstitutionChange,
  year,
  onYearChange,
}: ReturnType<typeof useFilteredAnalytics> & {
  institution?: string;
  onInstitutionChange?: (value: string) => void;
  year?: number;
  onYearChange?: (year: number) => void;
}) {
  return (
    <FilterBar>
      <FilterLabel>Filter by</FilterLabel>
      <FilterDivider />
      {onYearChange !== undefined && (
        <>
          <select
            value={year ?? CURRENT_YEAR}
            onChange={(e) => onYearChange(Number(e.target.value))}
            aria-label="Select year"
            className="min-w-[80px] rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black/70 outline-none transition-colors hover:border-gold-3/50 hover:text-black focus:border-gold-3 focus:text-black"
          >
            {AVAILABLE_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-text-4">›</span>
        </>
      )}
      <select
        value={filters.deaneryCode}
        onChange={(event) => setFilters({ deaneryCode: event.target.value, parishId: "", churchId: "" })}
        className="min-w-[148px] rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black/70 outline-none transition-colors hover:border-gold-3/50 hover:text-black focus:border-gold-3 focus:text-black"
      >
        <option value="">All Deaneries</option>
        {ORGANIZATION.map((d) => (
          <option key={d.code} value={d.code}>{d.name}</option>
        ))}
      </select>
      <span className="text-text-4">›</span>
      <select
        value={filters.parishId}
        disabled={!selectedDeanery}
        onChange={(event) => setFilters({ ...filters, parishId: event.target.value, churchId: "" })}
        className="min-w-[148px] rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black/70 outline-none transition-colors disabled:opacity-40 hover:border-gold-3/50 hover:text-black focus:border-gold-3 focus:text-black"
      >
        <option value="">All Parishes</option>
        {selectedDeanery?.parishes.map((parish) => (
          <option key={parish.id} value={parish.id}>{parish.name}</option>
        ))}
      </select>
      <span className="text-text-4">›</span>
      <select
        value={filters.churchId}
        disabled={!selectedParish}
        onChange={(event) => setFilters({ ...filters, churchId: event.target.value })}
        className="min-w-[148px] rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black/70 outline-none transition-colors disabled:opacity-40 hover:border-gold-3/50 hover:text-black focus:border-gold-3 focus:text-black"
      >
        <option value="">All Outstations</option>
        {selectedParish?.churches.map((church) => (
          <option key={church.id} value={church.id}>{church.name}</option>
        ))}
      </select>
      {onInstitutionChange && (
        <>
          <span className="text-text-4">›</span>
          <select
            value={institution ?? ""}
            onChange={(event) => onInstitutionChange(event.target.value)}
            className="min-w-[168px] rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black/70 outline-none transition-colors hover:border-gold-3/50 hover:text-black focus:border-gold-3 focus:text-black"
          >
            <option value="">All Institutions</option>
            {CUSA_INSTITUTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </>
      )}
      <button
        onClick={() => {
          setFilters(emptyFilters);
          onInstitutionChange?.("");
        }}
        className="rounded-md border border-border bg-transparent px-2.5 py-1 text-[9px] text-text-3 hover:border-danger hover:text-danger"
      >
        ✕ Clear
      </button>
      <FilterScope>{scope}</FilterScope>
    </FilterBar>
  );
}

const SEL_CLS = "min-w-[148px] rounded-md border border-black/20 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black/70 outline-none transition-colors disabled:opacity-40 hover:border-gold-3/50 hover:text-black focus:border-gold-3 focus:text-black";

function RpcFilterBar({
  rpc,
  institution,
  onInstitutionChange,
  year,
  onYearChange,
}: {
  rpc: ReturnType<typeof useRpcFilters>;
  institution?: string;
  onInstitutionChange?: (v: string) => void;
  year?: number;
  onYearChange?: (y: number) => void;
}) {
  return (
    <FilterBar>
      <FilterLabel>Filter by</FilterLabel>
      <FilterDivider />
      {onYearChange !== undefined && (
        <>
          <select value={year ?? CURRENT_YEAR} onChange={(e) => onYearChange(Number(e.target.value))} className={SEL_CLS} style={{ minWidth: 80 }}>
            {AVAILABLE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-text-4">›</span>
        </>
      )}
      <select
        value={rpc.filters.deaneryId}
        disabled={!!rpc.adminScope.deaneryId}
        onChange={(e) => rpc.setFilters({ deaneryId: e.target.value, parishId: "", outstationId: "" })}
        className={SEL_CLS}
      >
        <option value="">All Deaneries</option>
        {rpc.deaneryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="text-text-4">›</span>
      <select
        value={rpc.filters.parishId}
        disabled={!!rpc.adminScope.parishId || !rpc.effectiveDeaneryId}
        onChange={(e) => rpc.setFilters((f) => ({ ...f, parishId: e.target.value, outstationId: "" }))}
        className={SEL_CLS}
      >
        <option value="">All Parishes</option>
        {rpc.parishOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="text-text-4">›</span>
      <select
        value={rpc.filters.outstationId}
        disabled={!rpc.effectiveParishId}
        onChange={(e) => rpc.setFilters((f) => ({ ...f, outstationId: e.target.value }))}
        className={SEL_CLS}
      >
        <option value="">All Outstations</option>
        {rpc.outstationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {onInstitutionChange !== undefined && (
        <>
          <span className="text-text-4">›</span>
          <select value={institution ?? ""} onChange={(e) => onInstitutionChange(e.target.value)} className={SEL_CLS} style={{ minWidth: 168 }}>
            <option value="">All Institutions</option>
            {CUSA_INSTITUTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </>
      )}
      <button
        onClick={() => { rpc.clearFilters(); onInstitutionChange?.(""); }}
        className="rounded-md border border-border bg-transparent px-2.5 py-1 text-[9px] text-text-3 hover:border-danger hover:text-danger"
      >
        ✕ Clear
      </button>
      <FilterScope>{rpc.scopeLabel}</FilterScope>
    </FilterBar>
  );
}

/* ---------- TAB: Enrollment ---------- */

function EnrollmentTab({ chartDisplay }: { chartDisplay: ChartDisplay }) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const rpc = useRpcFilters();
  const { scopeParams, groupBy } = rpc;

  const { data: summary } = useQuery({
    queryKey: ["analytics-summary", year, scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId],
    queryFn: () => getAnalyticsSummary(year, scopeParams),
    staleTime: 30_000,
  });
  const { data: enrollBreakdown = [] } = useQuery({
    queryKey: ["enrollment-breakdown", year, scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId, groupBy],
    queryFn: () => getEnrollmentBreakdown(year, scopeParams, groupBy),
    staleTime: 30_000,
  });
  const { data: enrollmentTrend = [] } = useQuery({
    queryKey: ["enrollment-trend", year, scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId],
    queryFn: () => getEnrollmentTrend(year, scopeParams),
    staleTime: 30_000,
  });
  const { data: enrollmentStats } = useQuery({
    queryKey: ["enrollment-demographics", year, scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId],
    queryFn: () => getEnrollmentDemographics(year, scopeParams),
    staleTime: 30_000,
  });

  const totalYouths   = summary?.total_youths       ?? 0;
  const totalEnrolled = summary?.enrolled            ?? 0;
  const totalPending  = summary?.pending_enrollments ?? 0;
  const totalPaid     = enrollBreakdown.reduce((s, r) => s + r.paid, 0);
  const totalWaived   = enrollBreakdown.reduce((s, r) => s + r.waived, 0);
  const completionPct = pct(totalEnrolled, totalYouths);
  const maxYouths     = Math.max(...enrollBreakdown.map((r) => r.total_youths), 1);

  const catTotals = {
    primary:   enrollmentStats?.cat_primary   ?? 0,
    secondary: enrollmentStats?.cat_secondary ?? 0,
    tertiary:  enrollmentStats?.cat_tertiary  ?? 0,
    working:   enrollmentStats?.cat_working   ?? 0,
    other:     enrollmentStats?.cat_other     ?? 0,
  };
  const categoryData = [
    { label: "Primary",         value: catTotals.primary,   color: "var(--color-info)" },
    { label: "Secondary",       value: catTotals.secondary, color: "var(--color-success)" },
    { label: "Tertiary / CUSA", value: catTotals.tertiary,  color: "var(--color-violet)" },
    { label: "Working Youth",   value: catTotals.working,   color: "var(--color-gold)" },
    { label: "Other",           value: catTotals.other,     color: "var(--color-text-3)" },
  ].filter((d) => d.value > 0);

  const totalMale   = enrollmentStats?.male   ?? 0;
  const totalFemale = enrollmentStats?.female ?? 0;
  const maxTrend    = Math.max(...enrollmentTrend.map((r) => r.enrolled), 1);

  const trendRows = enrollmentTrend.map((row) => ({
    label: String(row.year),
    displayValue: chartDisplay === "percent" ? pct(row.enrolled, maxTrend) : row.enrolled,
    displayTrend: chartDisplay === "percent" ? pct(row.paid, maxTrend) : row.paid,
  }));

  return (
    <>
      <RpcFilterBar rpc={rpc} year={year} onYearChange={setYear} />

      <div className="mb-3.5 flex flex-wrap items-start gap-3.5 rounded-xl border border-danger/20 bg-gradient-to-r from-danger-soft via-white to-warn-soft p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-[20px]">🌱</div>
        <div className="min-w-[180px] flex-1">
          <div className="text-[13px] font-bold text-foreground">Enrollment Window — Year {year}</div>
          <div className="text-[10px] text-text-3">Showing data for {year} · {totalEnrolled.toLocaleString()} enrolled of {totalYouths.toLocaleString()} registered</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Stat value={`${completionPct}%`} label="completion" />
          <Stat value={totalEnrolled.toLocaleString()} label="enrolled" />
          <Stat value={Math.max(0, totalYouths - totalEnrolled).toLocaleString()} label="remaining" tone="warn" />
        </div>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label={`Enrolled ${year}`} value={totalEnrolled.toLocaleString()} trend={`${completionPct}% of registered`} tone="up" sub={`of ${totalYouths.toLocaleString()}`} />
        <Kpi label="Pending Payment"   value={totalPending.toLocaleString()}   trend="awaiting confirmation" tone="warn" sub="this year" />
        <Kpi label="Paid"              value={totalPaid.toLocaleString()}       trend="payment confirmed"     tone="up"   sub="this year" />
        <Kpi label="Waived"            value={totalWaived.toLocaleString()}     trend="fee waived"            tone="info" sub="this year" />
        <Kpi label="Completion Rate"   value={`${completionPct}%`}             trend="enrolled ÷ registered" tone="up"   sub={rpc.scopeLabel} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHead title="Enrollment Analytics" subtitle="Enrolled against scope target" />
          <CardBody>
            {enrollBreakdown.map((d) => <ProgressRow key={d.label} label={d.label} value={d.enrolled} max={maxYouths} display={chartDisplay} />)}
            {enrollBreakdown.length === 0 && <p className="py-4 text-center text-[11px] text-text-2">No data for selected filters.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Enrollment Category Mix" subtitle="Registered youths by category" />
          <CardBody>
            <Donut data={categoryData.length > 0 ? categoryData : [{ label: "No data", value: 1, color: "var(--color-border)" }]} display={chartDisplay} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHead title="Enrollment Trend" subtitle="Annual enrolled trend by year" />
          <CardBody className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendRows} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--color-text-3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-text-3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => chartDisplay === "percent" ? `${v}%` : Number(v).toLocaleString()} contentStyle={{ background: "var(--color-bg-2)", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-text-1)" }} />
                <Bar dataKey="displayValue" name="Enrolled" fill="var(--color-success)" radius={[5, 5, 0, 0]} />
                <Line type="monotone" dataKey="displayTrend" name="Trend" stroke="var(--color-gold)" strokeWidth={2.5} dot={{ r: 2, fill: "var(--color-gold)" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Gender Split" subtitle="Enrolled youths within selected filters" />
          <CardBody>
            {[
              { label: "Male",   value: totalMale,   color: "var(--color-info)" },
              { label: "Female", value: totalFemale, color: "var(--color-pink)" },
            ].map((row) => <ProgressRow key={row.label} label={row.label} value={row.value} max={(totalMale + totalFemale) || 1} color={row.color} display={chartDisplay} />)}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Stat({ value, label, tone = "up" }: { value: string; label: string; tone?: "up" | "warn" }) {
  return (
    <div className="rounded-md bg-bg-4 px-3 py-2 text-center">
      <div className={`text-[18px] font-black leading-none ${tone === "warn" ? "text-gold" : "text-success"}`}>{value}</div>
      <div className="mt-0.5 text-[7px] uppercase tracking-wide text-text-3">{label}</div>
    </div>
  );
}

/* ---------- TAB: CUSA ---------- */

function CusaTab({ chartDisplay }: { chartDisplay: ChartDisplay }) {
  const [institution, setInstitution] = useState("");
  const rpc = useRpcFilters();
  const { scopeParams, groupBy } = rpc;

  const { data: summary } = useQuery({
    queryKey: ["analytics-summary", CURRENT_YEAR, scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId],
    queryFn: () => getAnalyticsSummary(CURRENT_YEAR, scopeParams),
    staleTime: 30_000,
  });
  const { data: cusaBreakdown = [] } = useQuery({
    queryKey: ["cusa-breakdown", scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId, groupBy, institution],
    queryFn: () => getCusaBreakdown(CURRENT_YEAR, scopeParams, groupBy, institution || undefined),
    staleTime: 30_000,
  });

  const totalMembers  = summary?.cusa_members ?? 0;
  const totalActive   = summary?.cusa_active  ?? 0;
  const activityPct   = pct(totalActive, totalMembers);
  const maxTotal      = Math.max(...cusaBreakdown.map((r) => r.total), 1);
  const totalMale     = cusaBreakdown.reduce((s, r) => s + r.male, 0);
  const totalFemale   = cusaBreakdown.reduce((s, r) => s + r.female, 0);
  const totalWithRole = cusaBreakdown.reduce((s, r) => s + r.with_role, 0);

  return (
    <>
      <RpcFilterBar rpc={rpc} institution={institution} onInstitutionChange={setInstitution} />

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi label="CUSA Members"  value={totalMembers.toLocaleString()}              trend={`${totalActive} active`}   tone="up"   accent="var(--color-violet)" sub={institution || rpc.scopeLabel} />
        <Kpi label="Active Members" value={totalActive.toLocaleString()}              trend={`${activityPct}% activity`} tone="up"   accent="var(--color-violet)" />
        <Kpi label="Chapters"       value={cusaBreakdown.length.toLocaleString()}     trend="reporting"                  tone="info" accent="var(--color-violet)" />
        <Kpi label="Activity Rate"  value={`${activityPct}%`}                        trend="active members"             tone="up"   accent="var(--color-violet)" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHead title="CUSA Members Analytics" subtitle="Members by organisation" />
          <CardBody>
            {cusaBreakdown.map((d) => (
              <ProgressRow key={d.label} label={d.label} value={d.total} max={maxTotal} color="var(--color-violet)" display={chartDisplay} />
            ))}
            {cusaBreakdown.length === 0 && <p className="py-4 text-center text-[11px] text-text-2">No data for selected filters.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Active vs Total" subtitle="Members with an active role per unit" />
          <CardBody>
            {cusaBreakdown.map((d) => (
              <ProgressRow key={d.label} label={d.label} value={d.with_role} max={Math.max(d.total, 1)} color="var(--color-success)" display={chartDisplay} />
            ))}
            {cusaBreakdown.length === 0 && <p className="py-4 text-center text-[11px] text-text-2">No data for selected filters.</p>}
          </CardBody>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHead title="Gender Split" subtitle="CUSA members within selected filters" />
          <CardBody>
            {[
              { label: "Male",   value: totalMale,   color: "var(--color-info)" },
              { label: "Female", value: totalFemale, color: "var(--color-pink)" },
            ].map((row) => (
              <ProgressRow key={row.label} label={row.label} value={row.value} max={(totalMale + totalFemale) || 1} color={row.color} display={chartDisplay} />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="With Active Role" subtitle="Members who hold a defined CUSA role" />
          <CardBody>
            <Donut
              data={[
                { label: "With Role", value: totalWithRole,                              color: "var(--color-violet)" },
                { label: "No Role",   value: Math.max(0, totalMembers - totalWithRole),  color: "var(--color-bg-4)"  },
              ].filter((d) => d.value > 0)}
              display={chartDisplay}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/* ---------- TAB: Leaders ---------- */

const LEADER_LEVEL_LABELS: Record<string, string> = {
  diocese:    "Diocese",
  deanery:    "Deanery",
  parish:     "Parish",
  outstation: "Outstation",
};

const LEADER_LEVEL_COLORS: Record<string, string> = {
  diocese:    "var(--color-danger)",
  deanery:    "var(--color-gold)",
  parish:     "var(--color-info)",
  outstation: "var(--color-success)",
};

function LeadersTab({ chartDisplay }: { chartDisplay: ChartDisplay }) {
  const rpc = useRpcFilters();
  const { scopeParams, groupBy } = rpc;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics-summary", CURRENT_YEAR, scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId],
    queryFn:  () => getAnalyticsSummary(CURRENT_YEAR, scopeParams),
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const { data: breakdown = [], isLoading: breakdownLoading } = useQuery({
    queryKey: ["leader-breakdown", scopeParams.deaneryId, scopeParams.parishId, scopeParams.outstationId, groupBy],
    queryFn:  () => getLeaderBreakdown(scopeParams, groupBy),
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const isLoading = summaryLoading || breakdownLoading;
  const totalActive = summary?.active_leaders ?? 0;
  const maxActive = Math.max(...breakdown.map((r) => r.total_active), 1);

  const levelTotals = useMemo(() => ({
    diocese:    breakdown.reduce((s, r) => s + r.diocese_active, 0),
    deanery:    breakdown.reduce((s, r) => s + r.deanery_active, 0),
    parish:     breakdown.reduce((s, r) => s + r.parish_active, 0),
    outstation: breakdown.reduce((s, r) => s + r.outstation_active, 0),
  }), [breakdown]);

  const donutData = (["diocese", "deanery", "parish", "outstation"] as const)
    .map((level) => ({
      label: LEADER_LEVEL_LABELS[level],
      value: levelTotals[level],
      color: LEADER_LEVEL_COLORS[level],
    }))
    .filter((d) => d.value > 0);

  const orgColLabel = groupBy === "parish" ? "Parish" : groupBy === "outstation" ? "Outstation" : "Deanery";

  return (
    <>
      <RpcFilterBar rpc={rpc} />

      {/* KPIs */}
      <div className="mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Active Leaders" value={isLoading ? "—" : totalActive.toLocaleString()} trend={rpc.scopeLabel} tone="info" />
        {(["diocese", "deanery", "parish", "outstation"] as const).map((level) => (
          <Kpi
            key={level}
            label={`${LEADER_LEVEL_LABELS[level]} Level`}
            value={isLoading ? "—" : levelTotals[level].toLocaleString()}
            trend="active at this level"
            tone={level === "parish" ? "info" : level === "outstation" ? "up" : "warn"}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead
            title={`Leaders by ${orgColLabel}`}
            subtitle={`${breakdown.length} ${orgColLabel.toLowerCase()}${breakdown.length !== 1 ? "s" : ""} · ${rpc.scopeLabel}`}
          />
          <CardBody>
            {breakdown.length === 0 && !isLoading && (
              <p className="py-4 text-center text-[11px] text-text-2">No data for selected filters.</p>
            )}
            {breakdown.map((row) => (
              <ProgressRow
                key={row.id ?? row.label}
                label={row.label}
                value={row.total_active}
                max={maxActive}
                color="var(--color-info)"
                display={chartDisplay}
              />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Distribution by Level" subtitle="Active leaders per leadership tier" />
          <CardBody>
            {donutData.length > 0
              ? <Donut data={donutData} display={chartDisplay} />
              : <p className="py-4 text-center text-[11px] text-text-2">No data for selected filters.</p>
            }
          </CardBody>
        </Card>
      </div>

      {/* Summary table */}
      <div className="mt-3">
        <Card>
          <CardHead title="Leaders Summary" subtitle={`Active leaders by ${orgColLabel.toLowerCase()} and role level`} />
          <CardBody className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {[orgColLabel, "Diocese", "Deanery", "Parish", "Outstation", "Total"].map((h) => (
                    <TableHead key={h} className="label-eyebrow px-3 py-2">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.map((row) => (
                  <TableRow key={row.id ?? row.label} className="border-border/30 hover:bg-bg-3">
                    <TableCell className="px-3 py-2 text-[10px] font-semibold text-foreground">{row.label}</TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      {row.diocese_active > 0
                        ? <Pill tone="danger">{row.diocese_active}</Pill>
                        : <span className="text-[10px] text-text-4">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      {row.deanery_active > 0
                        ? <Pill tone="gold">{row.deanery_active}</Pill>
                        : <span className="text-[10px] text-text-4">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      {row.parish_active > 0
                        ? <Pill tone="info">{row.parish_active}</Pill>
                        : <span className="text-[10px] text-text-4">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      {row.outstation_active > 0
                        ? <Pill tone="success">{row.outstation_active}</Pill>
                        : <span className="text-[10px] text-text-4">—</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[10px] font-bold text-foreground">{row.total_active}</TableCell>
                  </TableRow>
                ))}
                {breakdown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-[11px] text-text-2">
                      No leader records match the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/* ---------- TAB: Mission Week ---------- */

function MissionTab({ chartDisplay }: { chartDisplay: ChartDisplay }) {
  const rpc = useRpcFilters();
  const zeroMissionRows = rpc.effectiveParishId
    ? rpc.outstationOptions.map((o) => ({ label: o.label, value: 0 }))
    : rpc.effectiveDeaneryId
      ? rpc.parishOptions.map((p) => ({ label: p.label, value: 0 }))
      : rpc.deaneryOptions.map((d) => ({ label: d.label, value: 0 }));
  const zeroGenderRows = [
    { label: "Female", value: 0, color: "var(--color-pink)" },
    { label: "Male", value: 0, color: "var(--color-info)" },
  ];

  return (
    <>
      <RpcFilterBar rpc={rpc} />

      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Mission Nominees" value="0" trend="no mission table" tone="up" sub={rpc.scopeLabel} />
        <Kpi label="Participating Units" value="0" trend="no mission table" tone="info" sub="database-backed scope" />
        <Kpi label="Reports Returned" value="0 / 0" trend="no mission table" tone="warn" sub="database-backed scope" />
        <Kpi label="Completion Rate" value="0%" trend="no mission table" tone="up" sub="database-backed scope" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHead title="Mission Nominees" subtitle="No mission table is provisioned yet, so counts remain zero." />
          <CardBody>
            {zeroMissionRows.map((row) => (
              <ProgressRow key={row.label} label={row.label} value={row.value} max={1} color="var(--color-gold)" display={chartDisplay} />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Reports Returned" subtitle="No mission table is provisioned yet, so counts remain zero." />
          <CardBody>
            {zeroMissionRows.map((row) => (
              <ProgressRow key={row.label} label={row.label} value={row.value} max={1} color="var(--color-info)" display={chartDisplay} />
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHead title="Gender Split" subtitle="Mission week data is not yet available" />
          <CardBody>
            {zeroGenderRows.map((row) => (
              <ProgressRow key={row.label} label={row.label} value={row.value} max={1} color={row.color} display={chartDisplay} />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Completion" subtitle="Mission week data is not yet available" />
          <CardBody>
            <Donut
              data={[
                { label: "Completed", value: 0, color: "var(--color-success)" },
                { label: "Pending", value: 0, color: "var(--color-border)" },
              ]}
              display={chartDisplay}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
