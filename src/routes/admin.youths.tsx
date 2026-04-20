import { createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";

export const Route = createFileRoute("/admin/youths")({
  head: () => ({
    meta: [
      { title: "Youth Records — CDM Youth Office" },
      { name: "description", content: "Searchable directory of all youth registered in the Catholic Diocese of Murang'a." },
    ],
  }),
  component: YouthsPage,
});

const SAMPLE = [
  ["Grace Wanjiku", "F", "17", "St. Joseph Murang'a", "Secondary", "active"],
  ["Peter Kamau", "M", "21", "Holy Family Maragua", "Tertiary", "active"],
  ["Mary Njeri", "F", "16", "St. Peter Kandara", "Secondary", "active"],
  ["John Mwangi", "M", "24", "Christ the King Kigumo", "Working", "active"],
  ["Faith Wairimu", "F", "13", "St. Mary Kangema", "Primary", "active"],
  ["Brian Otieno", "M", "20", "St. Joseph Murang'a", "Tertiary", "inactive"],
  ["Mercy Akinyi", "F", "22", "Holy Family Maragua", "Tertiary", "active"],
  ["Samuel Mwangi", "M", "19", "St. Peter Kandara", "Tertiary", "active"],
  ["Joy Wanjiru", "F", "18", "Christ the King Kigumo", "Tertiary", "active"],
  ["David Kariuki", "M", "26", "St. Mary Kangema", "Working", "active"],
];

function YouthsPage() {
  return (
    <>
      <Topbar title="Youth Records" action={<TopbarButton>Export CSV</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader title="Youth Directory" description="10,950 youths across 56 parishes." />
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Total" value="10,950" trend="+8.2%" tone="up" />
          <Kpi label="Active" value="10,612" trend="97%" tone="up" />
          <Kpi label="New (30d)" value="284" trend="+12%" tone="up" />
          <Kpi label="Graduated" value="338" trend="this year" tone="info" />
        </div>

        <Card>
          <CardHead title="All Youths" subtitle="Search, filter, export" action="Filters →" />
          <CardBody className="p-0">
            <div className="border-b border-border px-3.5 py-2.5">
              <input
                placeholder="Search by name, ID, parish…"
                className="w-full rounded-md border border-border bg-bg-2 px-3 py-2 text-[12px] text-foreground outline-none focus:border-gold-3"
              />
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Name", "Sex", "Age", "Parish", "Category", "Status"].map((h) => (
                    <th key={h} className="label-eyebrow px-3.5 py-2.5 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE.map((row, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                    <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">{row[0]}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row[1]}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row[2]}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row[3]}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row[4]}</td>
                    <td className="px-3.5 py-2.5">
                      <Pill tone={row[5] === "active" ? "success" : "neutral"}>{row[5]}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
