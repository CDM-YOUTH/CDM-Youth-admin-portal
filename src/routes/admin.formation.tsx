import { createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { FORMATION_ITEMS } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/formation")({
  head: () => ({
    meta: [
      { title: "Formation Library — CDM Youth Office" },
      { name: "description", content: "Central catechesis and formation library for all diocese youths." },
    ],
  }),
  component: FormationPage,
});

function FormationPage() {
  return (
    <>
      <Topbar title="Formation" action={<TopbarButton>+ Upload Content</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader title="Formation Library" description="Catechesis, reflections, prayer guides, and youth Bible study materials." />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Total Items" value="84" trend="+6 this month" tone="up" />
          <Kpi label="Total Views" value="14,820" trend="+1,204" tone="up" />
          <Kpi label="Audio" value="22" trend="" tone="info" />
          <Kpi label="Video" value="18" trend="" tone="info" />
        </div>

        <Card>
          <CardHead title="Recently Published" action="View library →" />
          <CardBody className="space-y-2">
            {FORMATION_ITEMS.map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-lg border border-border bg-bg-2 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bg-4 text-[14px]">
                  {f.kind === "Audio" ? "🎧" : f.kind === "Video" ? "▶" : "📄"}
                </div>
                <div className="flex-1 leading-tight">
                  <div className="text-[12px] font-semibold text-text-1">{f.title}</div>
                  <div className="text-[10px] text-text-3">
                    {f.kind} · {f.duration}
                  </div>
                </div>
                <Pill tone="info">{f.views} views</Pill>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
