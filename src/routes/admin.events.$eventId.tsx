import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill, ProgressRow } from "@/components/admin/ui-bits";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVENTS, ORGANIZATION } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Event Report — CDM Youth Office" },
      { name: "description", content: "Event planning, registration, assignments, day report, analytics, and gallery." },
    ],
  }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const event = EVENTS.find((item) => item.id === eventId) ?? EVENTS[0];
  const attendanceBase = event.status === "done" ? event.attended : event.registered;
  const memberAttendance = Math.max(0, attendanceBase - event.guests);
  const deaneries = ORGANIZATION.map((item) => item.name);
  const parishes = ORGANIZATION.flatMap((deanery) => deanery.parishes.map((parish) => parish.name));
  const locals = ORGANIZATION.flatMap((deanery) => deanery.parishes.flatMap((parish) => parish.churches.map((church) => church.name)));

  return (
    <>
      <Topbar title="Event Detail" action={<TopbarButton>Edit Event</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader title={event.name} description={`${event.date} · ${event.venue} · ${event.parish}`} />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Expected" value={event.expected.toLocaleString()} trend="planning target" tone="info" />
          <Kpi label="Registered" value={event.registered.toLocaleString()} trend="system numbers generated" tone="up" />
          <Kpi label="Attendance" value={attendanceBase.toLocaleString()} trend={event.status === "done" ? "final day count" : "expected check-in"} tone="up" />
          <Kpi label="Guests" value={event.guests.toLocaleString()} trend="not in member system" tone="warn" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHead title="Event Details" subtitle="View and edit the core information" action={<Pill tone={event.status === "done" ? "success" : "info"}>{event.status}</Pill>} />
            <CardBody>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Event name"><Input defaultValue={event.name} /></Field>
                <Field label="Date"><Input defaultValue={event.date} /></Field>
                <SelectField label="Deanery" placeholder="Select deanery" values={deaneries} />
                <SelectField label="Parish" placeholder={event.parish} values={parishes} />
                <SelectField label="Local church / outstation" placeholder="Select local" values={locals.slice(0, 24)} />
                <Field label="Venue"><Input defaultValue={event.venue} /></Field>
                <Field label="Expected"><Input type="number" defaultValue={event.expected} /></Field>
                <Field label="Registered"><Input type="number" defaultValue={event.registered} /></Field>
                <Field label="Notes"><Textarea defaultValue={`${event.name} planning, attendance and reporting notes.`} /></Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Day Report & Analytics" subtitle="Members, guests, and attendance against target" />
            <CardBody className="space-y-2">
              <ProgressRow label="Registered" value={event.registered} max={event.expected} color="var(--color-gold)" />
              <ProgressRow label="Members" value={memberAttendance} max={event.expected} color="var(--color-success)" />
              <ProgressRow label="Guests" value={event.guests} max={event.expected} color="var(--color-info)" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <SelectField label="Find member" placeholder="Name / number" values={["CY-2026-1042", "CY-2026-0871", "Grace Wanjiku", "Peter Mwangi"]} />
                <SelectField label="Attendance" placeholder="Mark status" values={["In attendance", "Expected", "Absent", "Guest"]} />
                <button className="rounded-lg border border-info/40 bg-info-soft px-3 py-2 text-[10px] font-bold text-info">Add non-member</button>
                <button className="rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-[10px] font-bold text-success">Generate number</button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card>
            <CardHead title="Program & Talks" subtitle="Sessions, topics, and facilitators" />
            <CardBody className="space-y-2">
              {event.program.map((item) => <RowItem key={`${item.time}-${item.activity}`} title={`${item.time} · ${item.activity}`} meta={item.facilitator} />)}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {event.topics.map((topic) => <Pill key={topic} tone="gold">{topic}</Pill>)}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Assignments" subtitle="Who was assigned what and where" />
            <CardBody className="space-y-2">
              {event.assignments.map((item) => <RowItem key={item.role} title={`${item.role} — ${item.person}`} meta={item.area} />)}
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Required Items" subtitle="Planning and actual use" />
            <CardBody className="space-y-2">
              {event.items.map((item) => <RowItem key={item.name} title={`${item.name} · ${item.quantity}`} meta={item.status} />)}
            </CardBody>
          </Card>
        </div>

        <Card className="mt-3">
          <CardHead title="Gallery" subtitle="Photos and evidence attached to this event" action="Upload →" />
          <CardBody className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {event.gallery.map((item) => (
              <div key={item} className="flex aspect-[4/3] items-end rounded-lg border border-border bg-gradient-to-br from-bg-4 to-bg-2 p-3 text-[11px] font-bold text-text-1">
                {item}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function RowItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-2 px-3 py-2">
      <div className="text-[11px] font-bold text-text-1">{title}</div>
      <div className="text-[9px] text-text-3">{meta}</div>
    </div>
  );
}