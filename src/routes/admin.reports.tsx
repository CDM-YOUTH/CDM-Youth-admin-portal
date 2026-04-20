import { createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, PageHeader } from "@/components/admin/ui-bits";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — CDM Youth Office" },
      { name: "description", content: "Generate diocese, deanery, and parish-level reports across all youth modules." },
    ],
  }),
  component: ReportsPage,
});

const REPORTS = [
  { title: "Annual Enrollment Summary", desc: "Year-on-year comparison across all parishes", kind: "PDF" },
  { title: "Deanery Performance", desc: "KPIs grouped by the 8 deaneries", kind: "Excel" },
  { title: "Mission Week Outcomes", desc: "Reshuffle pairings and post-execution survey", kind: "PDF" },
  { title: "Welfare Case Trends", desc: "Anonymised quarterly case-type analysis", kind: "PDF" },
  { title: "Formation Engagement", desc: "Most-viewed content and reach by age group", kind: "Excel" },
  { title: "Uniform Reconciliation", desc: "Stock vs. distribution vs. payment", kind: "Excel" },
];

function ReportsPage() {
  return (
    <>
      <Topbar title="Reports" action={<TopbarButton>+ Custom Report</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader title="Reports" description="Standard reports the Diocese, Deanery, and Parish admins can generate on demand." />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => (
            <Card key={r.title}>
              <CardHead title={r.title} subtitle={r.desc} />
              <CardBody className="flex items-center justify-between">
                <span className="rounded-md bg-bg-3 px-2 py-1 text-[10px] font-bold text-text-1">{r.kind}</span>
                <button className="rounded-md bg-gold px-3 py-1.5 text-[11px] font-bold text-gold-foreground hover:opacity-90">
                  Generate
                </button>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
