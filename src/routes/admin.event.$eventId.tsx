import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill, ProgressRow } from "@/components/admin/ui-bits";
import { EVENTS } from "@/lib/mock-data";
import { EventCheckinPanel } from "@/components/admin/event-checkin";
import {
  EventTabsForm,
  emptyEventState,
  type EventFormState,
} from "@/components/admin/event-tabs-form";

export const Route = createFileRoute("/admin/event/$eventId")({
  head: () => ({
    meta: [
      { title: "Event Report — CDM Youth Office" },
      { name: "description", content: "Event details, program, duties, attendance and reports." },
    ],
  }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const event = EVENTS.find((item) => item.id === eventId) ?? EVENTS[0];
  const attendanceBase = event.status === "done" ? event.attended : event.registered;
  const memberAttendance = Math.max(0, attendanceBase - event.guests);

  const [mode, setMode] = useState<"view" | "edit">("view");
  const isEdit = mode === "edit";

  // Seed the tabs form from the existing event mock data
  const seed: EventFormState = useMemo(() => {
    const base = emptyEventState();
    return {
      details: {
        ...base.details,
        name: event.name,
        venue: event.venue,
        expected: String(event.expected),
        deanery: "",
        parish: event.parish,
        description: `${event.name} planning, attendance and reporting notes.`,
      },
      program: event.program.length
        ? event.program.map((p, i) => ({
            id: `seed-${i}`,
            startTime: p.time,
            endTime: "",
            activities: [{ id: `seed-a-${i}`, name: p.activity }],
          }))
        : base.program,
      duties: base.duties,
    };
  }, [event]);

  return (
    <>
      <Topbar
        title={isEdit ? "Edit Event" : "Event Detail"}
        action={
          isEdit ? (
            <button
              onClick={() => setMode("view")}
              className="rounded-lg border border-border bg-bg-3 px-3 py-1.5 text-[11px] font-bold text-text-2"
            >
              Close editor
            </button>
          ) : (
            <TopbarButton onClick={() => setMode("edit")}>Edit Event</TopbarButton>
          )
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader title={event.name} description={`${event.date} · ${event.venue} · ${event.parish}`} />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Expected" value={event.expected.toLocaleString()} trend="planning target" tone="info" />
          <Kpi label="Registered" value={event.registered.toLocaleString()} trend="system numbers generated" tone="up" />
          <Kpi label="Attendance" value={attendanceBase.toLocaleString()} trend={event.status === "done" ? "final day count" : "expected check-in"} tone="up" />
          <Kpi label="Guests" value={event.guests.toLocaleString()} trend="not in member system" tone="warn" />
        </div>

        {isEdit ? (
          <Card>
            <CardHead
              title="Edit event"
              subtitle="Switch tabs anytime — your inputs persist between Details, Program and Duties."
              action={<Pill tone={event.status === "done" ? "success" : "info"}>{event.status}</Pill>}
            />
            <CardBody>
              <EventTabsForm
                initial={seed}
                submitLabel="Save all changes"
                onCancel={() => setMode("view")}
                onSave={(state) => {
                  toast.success(`Event “${state.details.name}” updated`);
                  setMode("view");
                }}
              />
            </CardBody>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHead
                  title="Event Details"
                  subtitle="Read-only view"
                  action={<Pill tone={event.status === "done" ? "success" : "info"}>{event.status}</Pill>}
                />
                <CardBody className="grid gap-2 md:grid-cols-2">
                  <ReadField label="Event name" value={event.name} />
                  <ReadField label="Date" value={event.date} />
                  <ReadField label="Venue" value={event.venue} />
                  <ReadField label="Parish" value={event.parish} />
                  <ReadField label="Expected" value={event.expected.toLocaleString()} />
                  <ReadField label="Registered" value={event.registered.toLocaleString()} />
                </CardBody>
              </Card>

              <Card>
                <CardHead title="Day Report & Analytics" subtitle="Members, guests, and attendance vs. target" />
                <CardBody className="space-y-2">
                  <ProgressRow label="Registered" value={event.registered} max={event.expected} color="var(--color-gold)" />
                  <ProgressRow label="Members" value={memberAttendance} max={event.expected} color="var(--color-success)" />
                  <ProgressRow label="Guests" value={event.guests} max={event.expected} color="var(--color-info)" />
                </CardBody>
              </Card>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Card>
                <CardHead title="Program" subtitle="Time slots and activities" />
                <CardBody className="space-y-2">
                  {event.program.map((p, i) => (
                    <RowItem key={i} title={`${p.time} · ${p.activity}`} meta={p.facilitator} />
                  ))}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.topics.map((topic) => <Pill key={topic} tone="gold">{topic}</Pill>)}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHead title="Duties" subtitle="Assigned roles and persons" />
                <CardBody className="space-y-2">
                  {event.assignments.map((a, i) => (
                    <RowItem key={i} title={`${a.role} — ${a.person}`} meta={a.area} />
                  ))}
                </CardBody>
              </Card>
            </div>

            <Card className="mt-3">
              <CardHead title="Gallery" subtitle="Photos and evidence attached to this event" />
              <CardBody className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {event.gallery.map((item) => (
                  <div key={item} className="flex aspect-[4/3] items-end rounded-lg border border-border bg-gradient-to-br from-bg-4 to-bg-2 p-3 text-[11px] font-bold text-text-1">
                    {item}
                  </div>
                ))}
              </CardBody>
            </Card>

            <div className="mt-3">
              <EventCheckinPanel eventId={event.id} eventName={event.name} />
            </div>
          </>
        )}
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

function ReadField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg-2 px-3 py-2">
      <div className="text-[9px] font-bold uppercase tracking-wide text-text-3">{label}</div>
      <div className="text-[12px] font-semibold text-text-1">{value}</div>
    </div>
  );
}
