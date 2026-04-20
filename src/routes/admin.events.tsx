import { createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { UPCOMING_EVENTS } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [
      { title: "Events — CDM Youth Office" },
      { name: "description", content: "Diocese-wide event scheduling, RSVP tracking, and attendance recording." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  return (
    <>
      <Topbar title="Events" action={<TopbarButton>+ New Event</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader title="Events Calendar" description="Schedule, broadcast, and track RSVPs across all parishes." />
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Upcoming" value="12" trend="next 30d" tone="info" />
          <Kpi label="Total RSVPs" value="1,566" trend="+184 today" tone="up" />
          <Kpi label="Reminders Sent" value="8,420" trend="SMS + in-app" tone="info" />
          <Kpi label="Avg Attendance" value="78%" trend="+4%" tone="up" />
        </div>

        <Card>
          <CardHead title="Upcoming Events" action="View calendar →" />
          <CardBody className="space-y-2">
            {UPCOMING_EVENTS.map((e) => (
              <div key={e.name} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-3">
                <div className="min-w-[52px] shrink-0 rounded-lg bg-bg-4 px-2.5 py-2 text-center">
                  <div className="text-[8px] font-bold uppercase tracking-wide text-gold">{e.month}</div>
                  <div className="text-display text-[22px] font-black leading-none text-foreground">{e.day}</div>
                </div>
                <div className="flex-1 leading-tight">
                  <div className="text-[12px] font-semibold text-text-1">{e.name}</div>
                  <div className="text-[10px] text-text-3">{e.parish}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone="success">{e.rsvp} RSVP</Pill>
                  <button className="rounded-md border border-border bg-bg-3 px-3 py-1.5 text-[10px] font-semibold text-text-1 hover:border-gold-3 hover:text-gold">
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
