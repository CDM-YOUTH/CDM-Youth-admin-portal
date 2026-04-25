import { createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";

const ENROLLMENT_ROWS: string[][] = [
  ["Grace Wanjiku", "St. Joseph Murang'a", "Secondary", "Today", "KES 500", "approved"],
  ["Peter Kamau", "Holy Family Maragua", "Tertiary", "Today", "KES 800", "pending"],
  ["Mary Njeri", "St. Peter Kandara", "Secondary", "Yesterday", "KES 500", "approved"],
  ["John Mwangi", "Christ the King Kigumo", "Working", "2d", "KES 1,000", "approved"],
  ["Faith Wairimu", "St. Mary Kangema", "Primary", "3d", "Pending", "pending"],
  ["Brian Otieno", "St. Joseph Murang'a", "Tertiary", "4d", "KES 800", "approved"],
  ["Mercy Akinyi", "Holy Family Maragua", "Tertiary", "4d", "KES 800", "approved"],
  ["Samuel Mwangi", "St. Peter Kandara", "Tertiary", "5d", "Pending", "pending"],
  ["Joy Wanjiru", "Christ the King Kigumo", "Tertiary", "5d", "KES 800", "approved"],
  ["David Kariuki", "St. Mary Kangema", "Working", "6d", "KES 1,000", "approved"],
  ["Linda Wambui", "St. Joseph Murang'a", "Secondary", "6d", "KES 500", "approved"],
  ["James Njoroge", "Holy Family Maragua", "Working", "7d", "Pending", "pending"],
  ["Esther Muthoni", "St. Peter Kandara", "Secondary", "7d", "KES 500", "approved"],
  ["Anne Maina", "Christ the King Kigumo", "Tertiary", "7d", "KES 800", "approved"],
];

export const Route = createFileRoute("/admin/enrollment")({
  head: () => ({
    meta: [
      { title: "Enrollment — CDM Youth Office" },
      {
        name: "description",
        content: "Annual youth enrollment with online payment tracking and parish-level approval queue.",
      },
    ],
  }),
  component: EnrollmentPage,
});

function EnrollmentPage() {
  return (
    <>
      <Topbar title="Enrollment" action={<TopbarButton>+ Enroll Youth</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Annual Enrollment 2026"
          description="Manage registrations, payment tracking, and parish-level approvals."
        />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Enrolled" value="8,240" trend="75% of target" tone="up" sub="of 11,000" />
          <Kpi label="Pending Payment" value="412" trend="KES 206,000" tone="warn" sub="outstanding" />
          <Kpi label="Awaiting Approval" value="23" trend="parish review" tone="warn" sub="queue" />
          <Kpi label="Self-Registered" value="3,180" trend="39% of total" tone="info" sub="via portal" />
        </div>

        <Card>
          <CardHead title="Recent Enrollments" subtitle="Last 7 days" action="View all →" />
          <CardBody className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Name", "Parish", "Category", "Date", "Payment", "Status"].map((h) => (
                    <th key={h} className="label-eyebrow px-3.5 py-2.5 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Grace Wanjiku", "St. Joseph Murang'a", "Secondary", "Today", "KES 500", "approved"],
                  ["Peter Kamau", "Holy Family Maragua", "Tertiary", "Today", "KES 800", "pending"],
                  ["Mary Njeri", "St. Peter Kandara", "Secondary", "Yesterday", "KES 500", "approved"],
                  ["John Mwangi", "Christ the King Kigumo", "Working", "2d", "KES 1,000", "approved"],
                  ["Faith Wairimu", "St. Mary Kangema", "Primary", "3d", "Pending", "pending"],
                  ["Brian Otieno", "St. Joseph Murang'a", "Tertiary", "4d", "KES 800", "approved"],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                    <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">{row[0]}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row[1]}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row[2]}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-3">{row[3]}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row[4]}</td>
                    <td className="px-3.5 py-2.5">
                      <Pill tone={row[5] === "approved" ? "success" : "gold"}>{row[5]}</Pill>
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
