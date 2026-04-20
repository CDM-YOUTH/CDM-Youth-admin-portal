import { createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";

export const Route = createFileRoute("/admin/cusa")({
  head: () => ({
    meta: [
      { title: "CUSA — CDM Youth Office" },
      { name: "description", content: "Catholic University Students Association: chapters, members, and events." },
    ],
  }),
  component: CusaPage,
});

const CHAPTERS = [
  { name: "University of Nairobi", members: 68, lead: "Faith Wairimu", reporting: true },
  { name: "Kenyatta University", members: 54, lead: "Brian Otieno", reporting: true },
  { name: "JKUAT", members: 42, lead: "Mercy Akinyi", reporting: true },
  { name: "Murang'a University", members: 38, lead: "Samuel Mwangi", reporting: true },
  { name: "Strathmore", members: 31, lead: "Joy Wanjiru", reporting: true },
  { name: "Multimedia University", members: 24, lead: "David Kariuki", reporting: false },
  { name: "Karatina University", members: 22, lead: "Linda Wambui", reporting: true },
  { name: "Dedan Kimathi", members: 18, lead: "James Njoroge", reporting: true },
  { name: "Catholic University", members: 15, lead: "Esther Muthoni", reporting: true },
];

function CusaPage() {
  return (
    <>
      <Topbar title="CUSA" action={<TopbarButton>+ New Chapter</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Catholic University Students Association"
          description="Tertiary-level youth body — chapters, leadership, and retreats."
        />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Members" value="312" trend="+18" tone="up" accent="var(--color-violet)" />
          <Kpi label="Universities" value="14" trend="+2 new" tone="up" accent="var(--color-violet)" />
          <Kpi label="Active Chapters" value="9" trend="all reporting" tone="up" accent="var(--color-violet)" />
          <Kpi label="Upcoming Retreats" value="3" trend="next 60d" tone="info" accent="var(--color-violet)" />
        </div>

        <Card>
          <CardHead title="University Chapters" action="Manage all →" />
          <CardBody>
            {CHAPTERS.map((c) => (
              <div key={c.name} className="flex items-center justify-between border-b border-border/30 py-2.5 last:border-0">
                <div>
                  <div className="text-[12px] font-semibold text-text-1">{c.name}</div>
                  <div className="text-[10px] text-text-3">Lead: {c.lead}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={c.reporting ? "success" : "gold"}>
                    {c.reporting ? "reporting" : "overdue"}
                  </Pill>
                  <Pill tone="violet">{c.members} members</Pill>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
