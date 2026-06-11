import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventFormState } from "@/components/admin/event-tabs-form";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { EventTabsForm } from "@/components/admin/event-tabs-form";
import { createEvent, deleteEvent, getEventsAnalytics, listEvents, type EventRow } from "@/lib/db/events";

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
  const qc = useQueryClient();
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: listEvents });
  const { data: analytics } = useQuery({ queryKey: ["events-analytics"], queryFn: getEventsAnalytics });
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => !e.event_date || e.event_date >= today);
  const done = events.filter((e) => e.event_date && e.event_date < today);
  const createMut = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      toast.success("Event created");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["events-analytics"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      toast.success("Event deleted");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["events-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <Topbar title="Events" action={<CreateEventDialog onCreate={(d) => createMut.mutate(d)} />} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader title="Events Calendar" description="Plan events, register participants, assign teams, and review post-event reports." />
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Upcoming" value={String(analytics?.upcoming ?? upcoming.length)} trend="future events" tone="info" />
          <Kpi label="Done" value={String(analytics?.done ?? done.length)} trend="completed" tone="up" />
          <Kpi label="Registered" value={(analytics?.registered ?? 0).toLocaleString()} trend="all events" tone="up" />
          <Kpi label="Total" value={String(events.length)} trend="in calendar" tone="up" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <EventList title="Upcoming Events" events={upcoming} onDelete={(id) => deleteMut.mutate(id)} />
          <EventList title="Done Events" events={done} onDelete={(id) => deleteMut.mutate(id)} />
        </div>
      </div>
    </>
  );
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function EventList({ title, events, onDelete }: { title: string; events: EventRow[]; onDelete: (id: string) => void }) {
  return (
    <Card>
      <CardHead title={title} action="Calendar →" />
      <CardBody className="space-y-2">
        {events.length === 0 && <div className="text-[11px] text-text-3">No events.</div>}
        {events.map((event) => {
          const d = event.event_date ? new Date(event.event_date) : null;
          const day = d ? String(d.getDate()).padStart(2, "0") : "—";
          const month = d ? MONTHS[d.getMonth()] : "—";
          const today = new Date().toISOString().slice(0, 10);
          const isDone = event.event_date && event.event_date < today;
          return (
          <div key={event.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-3">
            <div className="min-w-[52px] shrink-0 rounded-lg bg-bg-4 px-2.5 py-2 text-center">
              <div className="text-[8px] font-bold uppercase tracking-wide text-gold">{month}</div>
              <div className="text-display text-[22px] font-black leading-none text-foreground">{day}</div>
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12px] font-semibold text-text-1">{event.name}</div>
              <div className="text-[10px] text-text-3">{event.venue ?? "—"} · {event.parish?.name ?? event.deanery?.name ?? "Diocese-wide"}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Pill tone={isDone ? "success" : "info"}>{isDone ? "done" : "upcoming"}</Pill>
              <Link to="/admin/event/$eventId" params={{ eventId: event.id }} className="rounded-md border border-border bg-bg-3 px-3 py-1.5 text-[10px] font-semibold text-text-1 hover:border-gold-3 hover:text-gold">
                View / Edit
              </Link>
              <button
                onClick={() => { if (confirm(`Delete "${event.name}"?`)) onDelete(event.id); }}
                className="rounded border border-border p-1.5 text-text-3 hover:border-danger/50 hover:text-danger"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function CreateEventDialog({ onCreate }: { onCreate: (data: { name: string; eventDate?: string | null; venue?: string | null; description?: string | null; deaneryName?: string | null; parishName?: string | null; organizationLevel?: "Diocese"|"Deanery"|"Parish"|"Outstation"|null }) => void }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const handleSave = (state: EventFormState, eventId: string | null) => {
    if (eventId) {
      // Event was already persisted step-by-step — just refresh the list
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["events-analytics"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
      toast.success("Event created");
    } else {
      // Fallback: user skipped draft saves (shouldn't happen with new flow)
      onCreate({
        name: state.details.name,
        eventDate: state.details.date || null,
        venue: state.details.venue || null,
        description: state.details.description || null,
        deaneryName: state.details.deanery || null,
        parishName: state.details.parish || null,
        organizationLevel: (state.details.level || null) as "Diocese"|"Deanery"|"Parish"|"Outstation"|null,
      });
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <TopbarButton>+ New Event</TopbarButton>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">Create Event</DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            Save each step independently — your progress is kept even if you close the dialog.
          </DialogDescription>
        </DialogHeader>
        <EventTabsForm
          onCancel={() => setOpen(false)}
          submitLabel="Create event"
          onSave={handleSave}
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
