import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { DONE_EVENTS, EVENTS, UPCOMING_EVENTS } from "@/lib/mock-data";
import { EventTabsForm } from "@/components/admin/event-tabs-form";

type Row = Record<string, string>;
const blankRow = (labels: string[]): Row => Object.fromEntries(labels.map((l) => [l, ""]));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
      <span>{label}</span>
      {children}
    </label>
  );
}

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
              <Link to="/admin/event/$eventId" params={{ eventId: event.id }} className="rounded-md border border-border bg-bg-3 px-3 py-1.5 text-[10px] font-semibold text-text-1 hover:border-gold-3 hover:text-gold">
                View / Edit
              </Link>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function CreateEventDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <TopbarButton>+ New Event</TopbarButton>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black">Create Event</DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            Save each step independently. Switch tabs anytime — your inputs are kept.
          </DialogDescription>
        </DialogHeader>
        <EventTabsForm
          onCancel={() => setOpen(false)}
          submitLabel="Create event"
          onSave={(state) => {
            toast.success(`Event “${state.details.name}” created`);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function RepeatingRows({
  labels,
  rows,
  setRows,
  itemLabel,
}: {
  labels: string[];
  rows: Row[];
  setRows: (rows: Row[]) => void;
  itemLabel: string;
}) {
  const update = (index: number, key: string, value: string) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    setRows(next);
  };
  const remove = (index: number) => {
    if (rows.length === 1) {
      setRows([blankRow(labels)]);
      return;
    }
    setRows(rows.filter((_, i) => i !== index));
  };
  const add = () => setRows([...rows, blankRow(labels)]);

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="rounded-lg border border-border bg-bg-3 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-text-3">#{index + 1}</span>
            <button
              type="button"
              onClick={() => remove(index)}
              className="flex items-center gap-1 rounded-md border border-border bg-bg-2 px-2 py-1 text-[10px] font-bold text-text-2 hover:border-danger/50 hover:text-danger"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {labels.map((label) => (
              <Field key={label} label={label}>
                <Input
                  placeholder={label}
                  value={row[label] ?? ""}
                  onChange={(e) => update(index, label, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2 hover:border-gold-3 hover:text-gold"
      >
        <Plus className="h-3.5 w-3.5" /> Add another {itemLabel}
      </button>
    </div>
  );
}
