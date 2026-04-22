import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import {
  ACTIVITY_FEED,
  CATEGORY_SPLIT,
  CUSA_BY_DEANERY,
  DEANERIES,
  ENROLLMENT_BY_DEANERY,
  KPIS_CUSA,
  KPIS_ENROLLMENT,
  KPIS_GENERAL,
  MISSION_BY_DEANERY,
  TOP_PARISHES,
  UPCOMING_EVENTS,
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

/* ---------- TAB: General ---------- */

function GeneralTab() {
  return (
    <>
      <OrgFilterBar scope="Diocese-wide" />

      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {KPIS_GENERAL.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHead
              title="Enrollment by Deanery"
              subtitle="Drill into a deanery to see parishes → local churches"
            />
            <CardBody>
              {ENROLLMENT_BY_DEANERY.slice(0, 6).map((d) => (
                <ProgressRow
                  key={d.name}
                  label={d.name}
                  value={d.enrolled}
                  max={d.target}
                  color="var(--color-gold)"
                />
              ))}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card>
              <CardHead title="By Category" />
              <CardBody>
                <Donut data={CATEGORY_SPLIT} />
              </CardBody>
            </Card>
            <Card>
              <CardHead title="Gender Split" />
              <CardBody>
                <ProgressRow label="Male" value={54} max={100} color="var(--color-info)" />
                <ProgressRow label="Female" value={46} max={100} color="var(--color-pink)" />
                <div className="my-2 h-px bg-border" />
                <div className="label-eyebrow mb-2">Top Parishes</div>
                {TOP_PARISHES.slice(0, 4).map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between border-b border-border/50 py-1 text-[10px] last:border-0"
                  >
                    <span className="text-text-1">{p.name}</span>
                    <span className="font-bold text-gold">{p.enrolled}</span>
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
                <div
                  key={e.name}
                  className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-2.5"
                >
                  <div className="min-w-[44px] shrink-0 rounded-md bg-bg-4 px-2 py-1.5 text-center">
                    <div className="text-[7px] font-bold uppercase tracking-wide text-gold">
                      {e.month}
                    </div>
                    <div className="text-[18px] font-black leading-none text-foreground">
                      {e.day}
                    </div>
                  </div>
                  <div className="flex-1 leading-tight">
                    <div className="text-[11px] font-semibold text-text-1">{e.name}</div>
                    <div className="text-[9px] text-text-3">{e.parish}</div>
                  </div>
                  <Pill tone="success">{e.rsvp} RSVP</Pill>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function OrgFilterBar({ scope }: { scope: string }) {
  return (
    <FilterBar>
      <FilterLabel>Filter by</FilterLabel>
      <FilterDivider />
      <select className="min-w-[148px] rounded-md border border-gold-3 bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-gold outline-none">
        <option>All Deaneries</option>
        {DEANERIES.map((d) => (
          <option key={d.code}>{d.name}</option>
        ))}
      </select>
      <span className="text-text-4">›</span>
      <select
        disabled
        className="min-w-[148px] rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-text-2 opacity-40 outline-none"
      >
        <option>All Parishes</option>
      </select>
      <span className="text-text-4">›</span>
      <select
        disabled
        className="min-w-[148px] rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-text-2 opacity-40 outline-none"
      >
        <option>All Outstations</option>
      </select>
      <button className="rounded-md border border-border bg-transparent px-2.5 py-1 text-[9px] text-text-3 hover:border-danger hover:text-danger">
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

function FeedItem({
  kind,
  title,
  who,
  where,
  time,
}: {
  kind: string;
  title: string;
  who: string;
  where: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-bg-2 p-2.5">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[12px]"
        style={{ background: feedColor[kind] ?? "var(--color-bg-4)" }}
      >
        ●
      </div>
      <div className="flex-1 leading-tight">
        <div className="text-[10px] font-semibold text-text-1">
          {title} — <span className="text-gold">{who}</span>
        </div>
        <div className="text-[9px] text-text-3">{where}</div>
      </div>
      <span className="text-[9px] text-text-4">{time}</span>
    </div>
  );
}

/* ---------- TAB: Enrollment ---------- */

function EnrollmentTab() {
  return (
    <>
      <OrgFilterBar scope="Enrollment analytics" />

      <div className="mb-3.5 flex items-start gap-3.5 rounded-xl border border-success/20 bg-gradient-to-br from-bg-2 to-bg-1 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-[20px]">
          🌱
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-bold text-foreground">
            Enrollment Window — Year 2026
          </div>
          <div className="text-[10px] text-text-3">
            Open since 01 Jan 2026 · Closes 30 Apr 2026 · 41 days remaining
          </div>
        </div>
        <div className="flex gap-2">
          <Stat value="75%" label="of target" />
          <Stat value="8,240" label="enrolled" />
          <Stat value="412" label="pending" tone="warn" />
        </div>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {KPIS_ENROLLMENT.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHead title="Enrollment by Deanery" subtitle="Enrolled against annual target" />
          <CardBody>
            {ENROLLMENT_BY_DEANERY.map((d) => (
              <ProgressRow key={d.name} label={d.name} value={d.enrolled} max={d.target} />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Enrollment Category Mix" subtitle="Registered youths only" />
          <CardBody>
            <Donut data={CATEGORY_SPLIT} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Stat({ value, label, tone = "up" }: { value: string; label: string; tone?: "up" | "warn" }) {
  return (
    <div className="rounded-md bg-black/30 px-3 py-2 text-center">
      <div
        className={`text-[18px] font-black leading-none ${tone === "warn" ? "text-gold" : "text-success"}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[7px] uppercase tracking-wide text-text-3">{label}</div>
    </div>
  );
}

/* ---------- TAB: CUSA ---------- */

function CusaTab() {
  return (
    <>
      <OrgFilterBar scope="CUSA analytics" />

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {KPIS_CUSA.map((k) => (
          <Kpi key={k.label} {...k} accent="var(--color-violet)" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHead title="CUSA Members by Deanery" subtitle="Tertiary youth membership distribution" />
          <CardBody>
            {CUSA_BY_DEANERY.map((d) => (
              <ProgressRow key={d.name} label={d.name} value={d.members} max={74} color="var(--color-violet)" />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Chapter Reporting" subtitle="Active members against registered members" />
          <CardBody>
            {CUSA_BY_DEANERY.slice(0, 6).map((d) => (
              <ProgressRow key={d.name} label={d.name} value={d.active} max={d.members} color="var(--color-success)" />
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/* ---------- TAB: Mission Week ---------- */

function MissionTab() {
  return (
    <>
      <OrgFilterBar scope="Mission Week analytics" />

      <div className="mb-3.5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi label="Nominees" value="247" trend="+47 today" tone="up" />
        <Kpi label="Parishes Participating" value="56 / 56" trend="100%" tone="up" />
        <Kpi label="Reshuffle Pairs" value="124" trend="auto-generated" tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHead title="Nominees by Deanery" subtitle="Mission candidates submitted" />
          <CardBody>
            {MISSION_BY_DEANERY.map((d) => (
              <ProgressRow key={d.name} label={d.name} value={d.nominees} max={42} color="var(--color-gold)" />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Reports Returned" subtitle="Post-mission reporting completion" />
          <CardBody>
            {MISSION_BY_DEANERY.map((d) => (
              <ProgressRow key={d.name} label={d.name} value={d.reports} max={d.pairs} color="var(--color-info)" />
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
