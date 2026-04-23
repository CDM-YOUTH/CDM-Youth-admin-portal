import { Link, createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { DONE_EVENTS, EVENTS, UPCOMING_EVENTS } from "@/lib/mock-data";

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
  const doneAttendance = DONE_EVENTS.reduce((sum, event) => sum + event.attended, 0);
  const expected = UPCOMING_EVENTS.reduce((sum, event) => sum + event.expected, 0);

  return (
    <>
      <Topbar title="Events" action={<TopbarButton>+ New Event</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader title="Events Calendar" description="Plan events, register participants, assign teams, and review post-event reports." />
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Upcoming" value={String(UPCOMING_EVENTS.length)} trend={`${expected.toLocaleString()} expected`} tone="info" />
          <Kpi label="Done" value={String(DONE_EVENTS.length)} trend={`${doneAttendance.toLocaleString()} attended`} tone="up" />
          <Kpi label="Registered" value={EVENTS.reduce((sum, event) => sum + event.registered, 0).toLocaleString()} trend="member + guest lists" tone="up" />
          <Kpi label="Avg Attendance" value="92%" trend="completed events" tone="up" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <EventList title="Upcoming Events" events={UPCOMING_EVENTS} />
          <EventList title="Done Events" events={DONE_EVENTS} />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card>
            <CardHead title="Create / Edit Steps" subtitle="The event workflow to capture before publishing" />
            <CardBody className="space-y-2">
              {["Basic details", "Program & topics", "Activities", "Assignments", "Required items", "Registration setup", "Gallery & reports"].map((step, index) => (
                <div key={step} className="flex items-center gap-2 rounded-lg border border-border bg-bg-2 px-3 py-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[9px] font-black text-gold-foreground">{index + 1}</span>
                  <span className="text-[11px] font-semibold text-text-1">{step}</span>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card className="lg:col-span-2">
            <CardHead title="Registration Model" subtitle="Member selection plus walk-in attendance" />
            <CardBody className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {["Choose deanery", "Choose parish", "Choose outstation", "Select youth / CUSA member", "Generate event number", "Mark attended", "Add non-member guest", "Export day register", "Post-event analytics"].map((item) => (
                <div key={item} className="rounded-lg border border-border bg-bg-2 px-3 py-2 text-[11px] font-semibold text-text-1">{item}</div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function EventList({ title, events }: { title: string; events: typeof EVENTS }) {
  return (
    <Card>
      <CardHead title={title} action="Calendar →" />
      <CardBody className="space-y-2">
        {events.map((event) => (
          <div key={event.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-3">
            <div className="min-w-[52px] shrink-0 rounded-lg bg-bg-4 px-2.5 py-2 text-center">
              <div className="text-[8px] font-bold uppercase tracking-wide text-gold">{event.month}</div>
              <div className="text-display text-[22px] font-black leading-none text-foreground">{event.day}</div>
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12px] font-semibold text-text-1">{event.name}</div>
              <div className="text-[10px] text-text-3">{event.venue} · {event.parish}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Pill tone={event.status === "done" ? "success" : "info"}>{event.status === "done" ? `${event.attended} attended` : `${event.registered} RSVP`}</Pill>
              <Link to="/admin/events/$eventId" params={{ eventId: event.id }} className="rounded-md border border-border bg-bg-3 px-3 py-1.5 text-[10px] font-semibold text-text-1 hover:border-gold-3 hover:text-gold">
                View / Edit
              </Link>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
