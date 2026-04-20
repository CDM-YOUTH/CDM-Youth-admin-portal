import { createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { MISSION_PHASES } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/mission")({
  head: () => ({
    meta: [
      { title: "Mission Week — CDM Youth Office" },
      { name: "description", content: "Annual cross-parish youth reshuffle: nominations, automated pairing, and execution tracking." },
    ],
  }),
  component: MissionPage,
});

function MissionPage() {
  return (
    <>
      <Topbar title="Mission Week" action={<TopbarButton>Run Reshuffle</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Mission Week 2026"
          description="The annual cross-parish youth exchange. Nominations close 21 Feb — the algorithm pairs youths with host parishes automatically."
        />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Nominees" value="247" trend="+47 today" tone="up" />
          <Kpi label="Parishes" value="56 / 56" trend="100%" tone="up" />
          <Kpi label="Reshuffle Pairs" value="124" trend="auto-generated" tone="info" />
          <Kpi label="Days to Execution" value="9" trend="01 – 07 Mar" tone="warn" />
        </div>

        <Card className="mb-4">
          <CardHead title="Phase Tracker" subtitle="Cross-parish reshuffle in progress" />
          <CardBody className="space-y-1.5">
            {MISSION_PHASES.map((p) => (
              <div key={p.phase} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 px-3 py-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background:
                      p.status === "done"
                        ? "var(--color-success)"
                        : p.status === "active"
                          ? "var(--color-gold)"
                          : "var(--color-bg-4)",
                  }}
                />
                <div className="flex-1">
                  <div className="text-[11px] font-semibold text-text-1">Phase {p.phase} — {p.name}</div>
                  <div className="text-[9px] text-text-3">{p.date}</div>
                </div>
                <Pill tone={p.status === "done" ? "success" : p.status === "active" ? "gold" : "neutral"}>
                  {p.status}
                </Pill>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Reshuffle Preview" subtitle="Sample of generated pairings" action="View all 124 →" />
          <CardBody className="space-y-1.5">
            {[
              ["Grace Wanjiku", "St. Joseph Murang'a", "→", "Holy Family Maragua"],
              ["Peter Kamau", "Holy Family Maragua", "→", "St. Peter Kandara"],
              ["Mary Njeri", "St. Peter Kandara", "→", "Christ the King Kigumo"],
              ["John Mwangi", "Christ the King Kigumo", "→", "St. Mary Kangema"],
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-2.5 text-[11px]">
                <span className="font-semibold text-foreground">{row[0]}</span>
                <span className="text-text-3">{row[1]}</span>
                <span className="text-gold">{row[2]}</span>
                <span className="font-semibold text-text-1">{row[3]}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
