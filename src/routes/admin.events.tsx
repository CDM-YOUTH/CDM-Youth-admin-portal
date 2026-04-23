import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DONE_EVENTS, EVENTS, ORGANIZATION, UPCOMING_EVENTS } from "@/lib/mock-data";

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
      <Topbar title="Events" action={<CreateEventDialog />} />
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

const eventSteps = ["Basics", "Program", "Activities", "Assignments", "Items", "Registration"];

function CreateEventDialog() {
  const [step, setStep] = useState(0);
  const parishes = useMemo(() => ORGANIZATION.flatMap((deanery) => deanery.parishes), []);
  const selectedStep = eventSteps[step];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <TopbarButton>+ New Event</TopbarButton>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black">Create Event</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
          <div className="space-y-2">
            {eventSteps.map((item, index) => (
              <button
                key={item}
                onClick={() => setStep(index)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[11px] font-bold ${
                  step === index ? "border-gold bg-warn-soft text-gold" : "border-border bg-bg-2 text-text-2 hover:text-text-1"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bg-4 text-[9px]">{index + 1}</span>
                {item}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-bg-2 p-4">
            <div className="mb-3 text-[12px] font-black text-text-1">{selectedStep}</div>
            {step === 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Event name"><Input placeholder="Diocesan Youth Day" /></Field>
                <Field label="Date"><Input type="date" /></Field>
                <SelectField label="Deanery" placeholder="Select deanery" values={ORGANIZATION.map((item) => item.name)} />
                <SelectField label="Parish" placeholder="Select parish" values={parishes.map((item) => item.name)} />
                <Field label="Venue"><Input placeholder="Parish hall / grounds" /></Field>
                <Field label="Expected people"><Input type="number" placeholder="500" /></Field>
                <Field label="Description"><Textarea className="md:col-span-2" placeholder="Purpose and notes for the event" /></Field>
              </div>
            )}
            {step === 1 && <RepeatingFields labels={["Time", "Program activity", "Facilitator / speaker", "Talk topic"]} />}
            {step === 2 && <RepeatingFields labels={["Activity", "Responsible team", "Location", "Notes"]} />}
            {step === 3 && <RepeatingFields labels={["Role", "Assigned person / team", "Area", "Instructions"]} />}
            {step === 4 && <RepeatingFields labels={["Required item", "Quantity", "Status", "Used for"]} />}
            {step === 5 && (
              <div className="grid gap-3 md:grid-cols-2">
                <SelectField label="Register by" placeholder="Choose level" values={["Deanery", "Parish", "Local church", "CUSA institution"]} />
                <SelectField label="Number source" placeholder="Choose source" values={["System member number", "Name search", "Manual guest entry"]} />
                <Field label="Walk-in guest label"><Input placeholder="Non-member attendance" /></Field>
                <Field label="Attendance status"><Input placeholder="Expected / checked in / absent" /></Field>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <button onClick={() => setStep(Math.max(0, step - 1))} className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2 disabled:opacity-40" disabled={step === 0}>Back</button>
              <button onClick={() => setStep(Math.min(eventSteps.length - 1, step + 1))} className="rounded-lg bg-gold px-3 py-2 text-[11px] font-bold text-gold-foreground">{step === eventSteps.length - 1 ? "Save event" : "Next"}</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3"><span>{label}</span>{children}</label>;
}

function SelectField({ label, placeholder, values }: { label: string; placeholder: string; values: string[] }) {
  return (
    <Field label={label}>
      <Select>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>{values.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );
}

function RepeatingFields({ labels }: { labels: string[] }) {
  return <div className="grid gap-3 md:grid-cols-2">{labels.map((label) => <Field key={label} label={label}><Input placeholder={label} /></Field>)}</div>;
}
