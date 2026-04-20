import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, PageHeader, Pill } from "@/components/admin/ui-bits";
import { WELFARE_CASES } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/welfare")({
  head: () => ({
    meta: [
      { title: "Welfare Cases — CDM Youth Office" },
      {
        name: "description",
        content:
          "Confidential welfare case management: mental health, family crises, and pastoral support across all parishes.",
      },
    ],
  }),
  component: WelfarePage,
});

function WelfarePage() {
  return (
    <>
      <Topbar title="Welfare" action={<TopbarButton>+ New Case</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Welfare Cases"
          description="Confidential case management — Diocese, Deanery and Parish admins see only what their role permits."
        />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <MiniStat label="Open" value="5" tone="danger" />
          <MiniStat label="Urgent" value="2" tone="danger" />
          <MiniStat label="In Progress" value="12" tone="gold" />
          <MiniStat label="Resolved (30d)" value="34" tone="success" />
        </div>

        <Card>
          <CardHead title="Active Cases" subtitle="Sorted by urgency" action="Export →" />
          <CardBody className="space-y-2">
            {WELFARE_CASES.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border p-3 ${
                  c.urgency === "high"
                    ? "border-danger/40 bg-danger-soft/20"
                    : "border-border bg-bg-2"
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gold">{c.id}</span>
                    <Pill
                      tone={c.urgency === "high" ? "danger" : c.urgency === "medium" ? "gold" : "neutral"}
                    >
                      {c.urgency}
                    </Pill>
                  </div>
                  <span className="text-[9px] text-text-3">{c.opened}</span>
                </div>
                <div className="text-[12px] font-semibold text-foreground">{c.category}</div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-text-3">
                  <span>{c.parish}</span>
                  <span>Assigned: <span className="text-text-1">{c.assigned}</span></span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "danger" | "gold" | "success";
}) {
  const color =
    tone === "danger" ? "text-danger" : tone === "gold" ? "text-gold" : "text-success";
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="label-eyebrow mb-1.5">{label}</div>
      <div className={`text-display text-[24px] font-black leading-none ${color}`}>{value}</div>
    </div>
  );
}

export function _unused(): ReactNode {
  return null;
}
