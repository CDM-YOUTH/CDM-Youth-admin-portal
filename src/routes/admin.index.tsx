import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Topbar,
  TopbarTab,
  TopbarButton,
} from "@/components/admin/topbar";
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
} from "@/components/admin/ui-bits";
import { Donut } from "@/components/admin/donut";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CUSA_INSTITUTIONS, buildCusaMembers, cusaGenderRows, cusaInstitutionRows, cusaMembersFor } from "@/lib/cusa-data";
import {
  ACTIVITY_FEED,
  ANALYTICS_UNITS,
  ORGANIZATION,
  TOP_PARISHES,
  UPCOMING_EVENTS,
  type AnalyticsUnit,
} from "@/lib/mock-data";

export const Route = createFileRoute("/admin/")({
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

type Tab = "general" | "enrollment" | "cusa" | "mission";
type FilterState = { deaneryCode: string; parishId: string; churchId: string };

const emptyFilters: FilterState = { deaneryCode: "", parishId: "", churchId: "" };

function DashboardPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <>
      <Topbar
        title="Dashboard"
        tabs={
          <>
            <TopbarTab active={tab === "general"} onClick={() => setTab("general")}>
              General
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
        action={<TopbarButton>Export Report</TopbarButton>}
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === "general" && <GeneralTab />}
        {tab === "enrollment" && <EnrollmentTab />}
        {tab === "cusa" && <CusaTab />}
        {tab === "mission" && <MissionTab />}
      </div>
    </>
  );
}

function useFilteredAnalytics() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const selectedDeanery = ORGANIZATION.find((d) => d.code === filters.deaneryCode);
  const selectedParish = selectedDeanery?.parishes.find((p) => p.id === filters.parishId);
  const units = useMemo(
    () =>
      ANALYTICS_UNITS.filter((unit) => {
        if (filters.deaneryCode && unit.deaneryCode !== filters.deaneryCode) return false;
        if (filters.parishId && unit.parishId !== filters.parishId) return false;
        if (filters.churchId && unit.id !== filters.churchId) return false;
        return true;
      }),
    [filters],
  );

  const scope = filters.churchId
    ? selectedParish?.churches.find((church) => church.id === filters.churchId)?.name
    : selectedParish?.name ?? selectedDeanery?.name ?? "Diocese-wide";

  return { filters, setFilters, selectedDeanery, selectedParish, units, scope: scope ?? "Diocese-wide" };
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

function cusaRollupRows(units: AnalyticsUnit[], filters: FilterState, institution = "") {
  const groups = new Map<string, { label: string; value: number; max: number }>();
  units.forEach((unit) => {
    const key = filters.parishId ? unit.id : filters.deaneryCode ? unit.parishId : unit.deaneryCode;
    const label = filters.parishId ? unit.name : filters.deaneryCode ? unit.parishName : unit.deaneryName;
    const row = groups.get(key) ?? { label, value: 0, max: 0 };
    const members = cusaMembersFor(unit, institution);
    row.value += members;
    row.max += members;
    groups.set(key, row);
  });
  return [...groups.values()].filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
}

function categorySplit(units: AnalyticsUnit[]) {
  const totals = totalsFor(units);
  return [
    { label: "Primary", value: totals.primary, color: "var(--color-info)" },
    { label: "Secondary", value: totals.secondary, color: "var(--color-success)" },
    { label: "Tertiary / CUSA", value: totals.tertiary, color: "var(--color-violet)" },
    { label: "Working Youth", value: totals.working, color: "var(--color-gold)" },
  ];
}

function pct(value: number, max: number) {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}

function genderRows(units: AnalyticsUnit[], metric: "enrolled" | "missionNominees") {
  const total = units.reduce((sum, unit) => sum + unit[metric], 0);
  const female = units.reduce((sum, unit) => sum + Math.round(unit[metric] * (0.46 + (unit.youths % 13) / 100)), 0);
  return [
    { label: "Female", value: Math.min(female, total), color: "var(--color-pink)" },
    { label: "Male", value: Math.max(0, total - female), color: "var(--color-info)" },
  ];
}

function enrollmentTrendRows(units: AnalyticsUnit[]) {
  const total = totalsFor(units).enrolled;
  const weights = [0.04, 0.06, 0.08, 0.1, 0.08, 0.07, 0.09, 0.11, 0.1, 0.09, 0.1, 0.08];
  let cumulative = 0;
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((label, index) => {
    const monthly = Math.round(total * weights[index]);
    cumulative += monthly;
    return {
    label,
      value: monthly,
      cumulative: Math.min(total, cumulative),
    };
  });
}

/* ---------- TAB: General ---------- */

function GeneralTab() {
  const analytics = useFilteredAnalytics();
  const totals = totalsFor(analytics.units);
  const enrollmentRows = rollupRows(analytics.units, analytics.filters, "enrolled", "youths");
  const topParishes = analytics.filters.deaneryCode
    ? rollupRows(analytics.units, analytics.filters, "enrolled", "youths").slice(0, 4)
    : TOP_PARISHES.slice(0, 4).map((p) => ({ label: p.name, value: p.enrolled, max: p.enrolled }));

  return (
    <>
      <OrgFilterBar {...analytics} />

      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total Youths" value={totals.youths.toLocaleString()} trend="selected scope" tone="info" sub={analytics.scope} />
        <Kpi label="Enrolled" value={totals.enrolled.toLocaleString()} trend={`${pct(totals.enrolled, totals.youths)}% of target`} tone="up" />
        <Kpi label="CUSA Members" value={totals.cusaMembers.toLocaleString()} trend={`${totals.cusaActive} active`} tone="up" />
        <Kpi label="Mission Nominees" value={totals.missionNominees.toLocaleString()} trend={`${totals.missionReports} reports`} tone="info" />
        <Kpi label="Upcoming Events" value="12" trend="next 30d" tone="info" sub="diocese-wide" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHead title="Enrollment Analytics" subtitle="Changes with deanery, parish, and outstation filters" />
            <CardBody>
              {enrollmentRows.slice(0, 8).map((d) => (
                <ProgressRow key={d.label} label={d.label} value={d.value} max={d.max} color="var(--color-gold)" />
              ))}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card>
              <CardHead title="By Category" />
              <CardBody>
                <Donut data={categorySplit(analytics.units)} />
              </CardBody>
            </Card>
            <Card>
              <CardHead title="Gender Split" />
              <CardBody>
                <ProgressRow label="Male" value={Math.round(totals.enrolled * 0.54)} max={totals.enrolled || 1} color="var(--color-info)" />
                <ProgressRow label="Female" value={Math.round(totals.enrolled * 0.46)} max={totals.enrolled || 1} color="var(--color-pink)" />
                <div className="my-2 h-px bg-border" />
                <div className="label-eyebrow mb-2">Top Parishes</div>
                {topParishes.map((p) => (
                  <div key={p.label} className="flex items-center justify-between border-b border-border/50 py-1 text-[10px] last:border-0">
                    <span className="text-text-1">{p.label}</span>
                    <span className="font-bold text-gold">{p.value}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Card>
            <CardHead title="Live Activity Feed" action="Audit log →" />
            <CardBody className="space-y-1.5">
              {ACTIVITY_FEED.map((f, i) => (
                <FeedItem key={i} {...f} />
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Upcoming Events" action="View all →" />
            <CardBody className="space-y-2">
              {UPCOMING_EVENTS.slice(0, 3).map((e) => (
                <div key={e.name} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-2.5">
                  <div className="min-w-[44px] shrink-0 rounded-md bg-bg-4 px-2 py-1.5 text-center">
                    <div className="text-[7px] font-bold uppercase tracking-wide text-gold">{e.month}</div>
                    <div className="text-[18px] font-black leading-none text-foreground">{e.day}</div>
                  </div>
                  <div className="flex-1 leading-tight">
                    <div className="text-[11px] font-semibold text-text-1">{e.name}</div>
                    <div className="text-[9px] text-text-3">{e.parish}</div>
                  </div>
                  <Pill tone="success">{e.registered} RSVP</Pill>
                </div>
              ))}
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
}: ReturnType<typeof useFilteredAnalytics> & { institution?: string; onInstitutionChange?: (value: string) => void }) {
  return (
    <FilterBar>
      <FilterLabel>Filter by</FilterLabel>
      <FilterDivider />
      <select
        value={filters.deaneryCode}
        onChange={(event) => setFilters({ deaneryCode: event.target.value, parishId: "", churchId: "" })}
        className="min-w-[148px] rounded-md border border-gold-3 bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-gold outline-none"
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
        className="min-w-[148px] rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-text-2 outline-none disabled:opacity-40"
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
        className="min-w-[148px] rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-text-2 outline-none disabled:opacity-40"
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
            className="min-w-[168px] rounded-md border border-violet bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-violet outline-none"
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

const feedColor: Record<string, string> = {
  enroll: "var(--color-success-soft)",
  event: "var(--color-info-soft)",
  mission: "var(--color-warn-soft)",
  welfare: "var(--color-danger-soft)",
  uniform: "var(--color-violet-soft)",
  formation: "var(--color-bg-4)",
};

function FeedItem({ kind, title, who, where, time }: { kind: string; title: string; who: string; where: string; time: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-bg-2 p-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[12px]" style={{ background: feedColor[kind] ?? "var(--color-bg-4)" }}>
        ●
      </div>
      <div className="flex-1 leading-tight">
        <div className="text-[10px] font-semibold text-text-1">{title} — <span className="text-gold">{who}</span></div>
        <div className="text-[9px] text-text-3">{where}</div>
      </div>
      <span className="text-[9px] text-text-4">{time}</span>
    </div>
  );
}

/* ---------- TAB: Enrollment ---------- */

function EnrollmentTab() {
  const analytics = useFilteredAnalytics();
  const totals = totalsFor(analytics.units);
  const rows = rollupRows(analytics.units, analytics.filters, "enrolled", "youths");
  const trendRows = enrollmentTrendRows(analytics.units);

  return (
    <>
      <OrgFilterBar {...analytics} />

      <div className="mb-3.5 flex flex-wrap items-start gap-3.5 rounded-xl border border-success/20 bg-gradient-to-br from-bg-2 to-bg-1 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-[20px]">🌱</div>
        <div className="min-w-[180px] flex-1">
          <div className="text-[13px] font-bold text-foreground">Enrollment Window — Year 2026</div>
          <div className="text-[10px] text-text-3">Open since 01 Jan 2026 · Closes 30 Apr 2026 · 41 days remaining</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Stat value={`${pct(totals.enrolled, totals.youths)}%`} label="of target" />
          <Stat value={totals.enrolled.toLocaleString()} label="enrolled" />
          <Stat value={Math.max(0, totals.youths - totals.enrolled).toLocaleString()} label="remaining" tone="warn" />
        </div>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Enrolled 2026" value={totals.enrolled.toLocaleString()} trend={`${pct(totals.enrolled, totals.youths)}% of target`} tone="up" sub={`of ${totals.youths.toLocaleString()}`} />
        <Kpi label="Pending Payment" value={Math.round(totals.enrolled * 0.05).toLocaleString()} trend={`KES ${(Math.round(totals.enrolled * 0.05) * 500).toLocaleString()}`} tone="warn" sub="outstanding" />
        <Kpi label="Self-Registered" value={Math.round(totals.enrolled * 0.39).toLocaleString()} trend="39% of total" tone="info" sub="via Youth Portal" />
        <Kpi label="Awaiting Approval" value={Math.max(3, Math.round(totals.enrolled * 0.01)).toLocaleString()} trend="parish review" tone="warn" sub="queue" />
        <Kpi label="Completion Rate" value={`${pct(totals.enrolled, totals.youths)}%`} trend="live filter" tone="up" sub={analytics.scope} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHead title="Enrollment Analytics" subtitle="Enrolled against selected scope target" />
          <CardBody>
            {rows.map((d) => <ProgressRow key={d.label} label={d.label} value={d.value} max={d.max} />)}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Enrollment Category Mix" subtitle="Registered youths only" />
          <CardBody>
            <Donut data={categorySplit(analytics.units)} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHead title="Enrollment Trend" subtitle="Monthly bars with cumulative year trend" />
          <CardBody className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendRows} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--color-text-3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-text-3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-bg-2)", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-text-1)" }} />
                <Bar dataKey="value" name="Monthly" fill="var(--color-success)" radius={[5, 5, 0, 0]} />
                <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="var(--color-gold)" strokeWidth={2.5} dot={{ r: 2, fill: "var(--color-gold)" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Gender Split" subtitle="Enrolled youths within selected filters" />
          <CardBody>
            {genderRows(analytics.units, "enrolled").map((row) => <ProgressRow key={row.label} label={row.label} value={row.value} max={totals.enrolled || 1} color={row.color} />)}
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

function CusaTab() {
  const analytics = useFilteredAnalytics();
  const [institution, setInstitution] = useState("");
  const totals = totalsFor(analytics.units);
  const filteredMembers = analytics.units.reduce((sum, unit) => sum + cusaMembersFor(unit, institution), 0);
  const memberRows = cusaRollupRows(analytics.units, analytics.filters, institution);
  const institutionRows = cusaInstitutionRows(analytics.units);
  const maxInstitution = Math.max(...institutionRows.map((row) => row.value), 1);
  const gender = cusaGenderRows(analytics.units, institution);

  return (
    <>
      <OrgFilterBar {...analytics} institution={institution} onInstitutionChange={setInstitution} />

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi label="CUSA Members" value={filteredMembers.toLocaleString()} trend={`${totals.cusaActive} active`} tone="up" accent="var(--color-violet)" sub={institution || analytics.scope} />
        <Kpi label="Universities" value={String(institution ? 1 : institutionRows.length)} trend="represented" tone="info" accent="var(--color-violet)" />
        <Kpi label="Active Chapters" value={String(Math.max(1, memberRows.length))} trend="reporting" tone="up" accent="var(--color-violet)" />
        <Kpi label="Activity Rate" value={`${pct(totals.cusaActive, totals.cusaMembers)}%`} trend="active members" tone="up" accent="var(--color-violet)" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHead title="CUSA Members Analytics" subtitle="Members by parish or outstation" />
          <CardBody>
            {memberRows.map((d) => <ProgressRow key={d.label} label={d.label} value={d.value} max={memberRows[0]?.value || 1} color="var(--color-violet)" />)}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Chapter Reporting" subtitle="Members by institution" />
          <CardBody>
            {(institution ? institutionRows.filter((row) => row.label === institution) : institutionRows).map((d) => <ProgressRow key={d.label} label={d.label} value={d.value} max={maxInstitution} color="var(--color-success)" />)}
          </CardBody>
        </Card>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHead title="Gender Split" subtitle="CUSA members within selected filters" />
          <CardBody>
            {gender.map((row) => <ProgressRow key={row.label} label={row.label} value={row.value} max={filteredMembers || 1} color={row.color} />)}
          </CardBody>
        </Card>
        <CusaMemberTable units={analytics.units} institution={institution} />
      </div>
    </>
  );
}

function CusaMemberTable({ units, institution }: { units: AnalyticsUnit[]; institution: string }) {
  const members = buildCusaMembers(units, institution).slice(0, 10);

  return (
    <Card>
      <CardHead title="CUSA Members Table" subtitle="Filtered by organization and institution" />
      <CardBody className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {["Name", "Institution", "Parish", "Outstation", "Gender", "Course", "Status"].map((heading) => (
                <TableHead key={heading} className="label-eyebrow px-3 py-2">{heading}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id} className="border-border/30 hover:bg-bg-3">
                <TableCell className="px-3 py-2 text-[10px] font-semibold text-foreground">{member.name}</TableCell>
                <TableCell className="px-3 py-2 text-[10px] text-text-1">{member.institution}</TableCell>
                <TableCell className="px-3 py-2 text-[10px] text-text-2">{member.parishName}</TableCell>
                <TableCell className="px-3 py-2 text-[10px] text-text-2">{member.churchName}</TableCell>
                <TableCell className="px-3 py-2 text-[10px] text-text-2">{member.gender}</TableCell>
                <TableCell className="px-3 py-2 text-[10px] text-text-2">{member.course} · {member.year}</TableCell>
                <TableCell className="px-3 py-2"><Pill tone={member.status === "active" ? "success" : "violet"}>{member.status}</Pill></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}

/* ---------- TAB: Mission Week ---------- */

function MissionTab() {
  const analytics = useFilteredAnalytics();
  const totals = totalsFor(analytics.units);
  const nomineeRows = rollupRows(analytics.units, analytics.filters, "missionNominees", "missionNominees");
  const reportRows = rollupRows(analytics.units, analytics.filters, "missionReports", "missionPairs");

  return (
    <>
      <OrgFilterBar {...analytics} />

      <div className="mb-3.5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi label="Nominees" value={totals.missionNominees.toLocaleString()} trend="selected scope" tone="up" />
        <Kpi label="Parishes Participating" value={String(new Set(analytics.units.map((unit) => unit.parishId)).size)} trend="filtered" tone="up" />
        <Kpi label="Reports Returned" value={`${totals.missionReports} / ${totals.missionPairs}`} trend={`${pct(totals.missionReports, totals.missionPairs)}%`} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHead title="Nominees Analytics" subtitle="Mission candidates submitted" />
          <CardBody>
            {nomineeRows.map((d) => <ProgressRow key={d.label} label={d.label} value={d.value} max={nomineeRows[0]?.value || 1} color="var(--color-gold)" />)}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Reports Returned" subtitle="Post-mission reporting completion" />
          <CardBody>
            {reportRows.map((d) => <ProgressRow key={d.label} label={d.label} value={d.value} max={d.max} color="var(--color-info)" />)}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Gender Split" subtitle="Mission nominees within selected filters" />
          <CardBody>
            {genderRows(analytics.units, "missionNominees").map((row) => <ProgressRow key={row.label} label={row.label} value={row.value} max={totals.missionNominees || 1} color={row.color} />)}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
