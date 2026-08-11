import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventFormState } from "@/components/admin/events/event-tabs-form";
import { Topbar, TopbarButton } from "@/components/admin/layout/topbar";
import { Card, CardBody, CardHead, Kpi, Pill } from "@/components/admin/composables/ui-bits";
import { TablePagination } from "@/components/admin/composables/tables/table-pagination";
import { FilterRow, FilterSearch, FilterSelect, FilterClear } from "@/components/admin/composables/tables/table-filters";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2 } from "lucide-react";
import { EventTabsForm } from "@/components/admin/events/event-tabs-form";
import { createEvent, deleteEvent, getEventsAnalytics, listEventsPaged, type EventRow } from "@/lib/db/activities/events";
import { fetchOrg } from "@/lib/db/org";
import { useAdminScope } from "@/lib/hooks/use-admin-scope";

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

const eventSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  deanery_id: fallback(z.string(), "").default(""),
  parish_id: fallback(z.string(), "").default(""),
  upcoming_page: fallback(z.number().int().min(1), 1).default(1),
  ongoing_page:  fallback(z.number().int().min(1), 1).default(1),
  done_page: fallback(z.number().int().min(1), 1).default(1),
  size: fallback(z.number().int().min(1).max(50), 8).default(8),
});

type EventSearch = z.infer<typeof eventSearchSchema>;

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [
      { title: "Events — CDM Youth Office" },
      { name: "description", content: "Diocese-wide event scheduling, RSVP tracking, and attendance recording." },
    ],
  }),
  validateSearch: zodValidator(eventSearchSchema),
  component: EventsPage,
});

function EventsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();

  const setFilter = (patch: Partial<EventSearch>) => {
    navigate({ search: (prev: EventSearch) => ({ ...prev, ...patch }), replace: true });
  };

  const scope = useAdminScope();
  const deaneryId = scope.deaneryId || search.deanery_id;
  const parishId  = scope.parishId  || search.parish_id;

  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const { data: analytics } = useQuery({ queryKey: ["events-analytics"], queryFn: getEventsAnalytics });

  const { data: upcomingResp } = useQuery({
    queryKey: ["events", "upcoming", search.q, deaneryId, parishId, search.upcoming_page, search.size],
    queryFn: () => listEventsPaged({ page: search.upcoming_page - 1, size: search.size, q: search.q, deaneryId: deaneryId || null, parishId: parishId || null, period: "upcoming" }),
    placeholderData: keepPreviousData,
  });

  const { data: ongoingResp } = useQuery({
    queryKey: ["events", "ongoing", search.q, deaneryId, parishId, search.ongoing_page, search.size],
    queryFn: () => listEventsPaged({ page: search.ongoing_page - 1, size: search.size, q: search.q, deaneryId: deaneryId || null, parishId: parishId || null, period: "ongoing" }),
    placeholderData: keepPreviousData,
  });

  const { data: doneResp } = useQuery({
    queryKey: ["events", "done", search.q, deaneryId, parishId, search.done_page, search.size],
    queryFn: () => listEventsPaged({ page: search.done_page - 1, size: search.size, q: search.q, deaneryId: deaneryId || null, parishId: parishId || null, period: "done" }),
    placeholderData: keepPreviousData,
  });

  const upcomingEvents = upcomingResp?.data ?? [];
  const ongoingEvents  = ongoingResp?.data  ?? [];
  const doneEvents     = doneResp?.data     ?? [];
  const upcomingTotal  = upcomingResp?.total ?? 0;
  const ongoingTotal   = ongoingResp?.total  ?? 0;
  const doneTotal      = doneResp?.total     ?? 0;

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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
      toast.success("Event deleted — registrants have been notified.");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["events-analytics"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deaneryOptions = (org?.deaneries ?? []).map((d) => ({ value: d.id, label: d.name }));
  const parishOptions = (org?.parishes ?? [])
    .filter((p) => !deaneryId || p.deanery_id === deaneryId)
    .map((p) => ({ value: p.id, label: p.name }));
  const hasFilter = !!(search.q || search.deanery_id || search.parish_id);

  return (
    <>
      <Topbar
        title="Events Calendar"
        description="Plan events, register participants, assign teams, and review post-event reports."
        action={<CreateEventDialog onCreate={(d) => createMut.mutate(d)} />}
      />
      <div className="flex-1 overflow-y-auto">
        <FilterRow>
          <FilterSearch
            value={search.q}
            onChange={(v) => setFilter({ q: v, upcoming_page: 1, ongoing_page: 1, done_page: 1 })}
            placeholder="Search events, venues…"
          />
          <FilterSelect
            label="Deanery"
            value={deaneryId}
            onChange={(v) => setFilter({ deanery_id: v, parish_id: "", upcoming_page: 1, ongoing_page: 1, done_page: 1 })}
            options={deaneryOptions}
            disabled={!!scope.deaneryId}
          />
          <FilterSelect
            label="Parish"
            value={parishId}
            onChange={(v) => setFilter({ parish_id: v, upcoming_page: 1, ongoing_page: 1, done_page: 1 })}
            options={parishOptions}
            disabled={!!scope.parishId || (!deaneryId && parishOptions.length === 0)}
          />
          <FilterClear
            visible={hasFilter}
            onClick={() => setFilter({ q: "", deanery_id: "", parish_id: "", upcoming_page: 1, ongoing_page: 1, done_page: 1 })}
          />
        </FilterRow>

        <div className="px-5 py-4">
          <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
            <Kpi label="Upcoming" value={String(analytics?.upcoming ?? upcomingTotal)} trend="future events" tone="info" />
            <Kpi label="Ongoing" value={String(analytics?.ongoing ?? ongoingTotal)} trend="in progress" tone="warn" />
            <Kpi label="Done" value={String(analytics?.done ?? doneTotal)} trend="completed" tone="up" />
            <Kpi label="Registered" value={(analytics?.registered ?? 0).toLocaleString()} trend="all events" tone="up" />
          </div>

          <div className="space-y-3">
            {(ongoingEvents.length > 0 || ongoingTotal > 0) && (
              <EventList
                title="Ongoing Events"
                events={ongoingEvents}
                total={ongoingTotal}
                page={search.ongoing_page}
                size={search.size}
                onPageChange={(p) => setFilter({ ongoing_page: p })}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
                period="ongoing"
              />
            )}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
              <EventList
                title="Upcoming Events"
                events={upcomingEvents}
                total={upcomingTotal}
                page={search.upcoming_page}
                size={search.size}
                onPageChange={(p) => setFilter({ upcoming_page: p })}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
                period="upcoming"
              />
              <EventList
                title="Done Events"
                events={doneEvents}
                total={doneTotal}
                page={search.done_page}
                size={search.size}
                onPageChange={(p) => setFilter({ done_page: p })}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
                period="done"
              />
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the event, its program, duty assignments, and RSVPs. Everyone
              currently registered will be sent a cancellation notification. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Delete &amp; notify
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function EventList({
  title,
  events,
  total,
  page,
  size,
  onPageChange,
  onDelete,
  period = "upcoming",
}: {
  title: string;
  events: EventRow[];
  total: number;
  page: number;
  size: number;
  onPageChange: (p: number) => void;
  onDelete: (id: string, name: string) => void;
  period?: "upcoming" | "ongoing" | "done";
}) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const pillTone = period === "done" ? "success" : period === "ongoing" ? "gold" : "info";
  return (
    <Card>
      <CardHead title={title} action="Calendar →" />
      <CardBody className="space-y-2">
        {events.length === 0 && <div className="text-[11px] text-text-3">No events.</div>}
        {events.map((event) => {
          const d = event.event_date ? new Date(event.event_date) : null;
          const day = d ? String(d.getDate()).padStart(2, "0") : "—";
          const month = d ? MONTHS[d.getMonth()] : "—";
          const endD = event.end_date ? new Date(event.end_date) : null;
          const endDay = endD ? String(endD.getDate()).padStart(2, "0") : null;
          const endMonth = endD ? MONTHS[endD.getMonth()] : null;
          return (
          <div key={event.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-3">
            <div className="min-w-[52px] shrink-0 rounded-lg bg-bg-4 px-2.5 py-2 text-center">
              <div className="text-[8px] font-bold uppercase tracking-wide text-gold">{month}</div>
              <div className="text-display text-[22px] font-black leading-none text-foreground">{day}</div>
              {endDay && endMonth && (
                <div className="mt-0.5 text-[7px] font-semibold uppercase tracking-wide text-text-3">→ {endDay} {endMonth}</div>
              )}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12px] font-semibold text-text-1">{event.name}</div>
              <div className="text-[10px] text-text-3">{event.venue ?? "—"} · {event.parish?.name ?? event.deanery?.name ?? "Diocese-wide"}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Pill tone={pillTone}>{period}</Pill>
              <Link to="/admin/event/$eventId" params={{ eventId: event.id }} className="rounded-md border border-border bg-bg-3 px-3 py-1.5 text-[10px] font-semibold text-text-1 hover:border-gold-3 hover:text-gold">
                View / Edit
              </Link>
              <button
                onClick={() => onDelete(event.id, event.name)}
                className="rounded border border-border p-1.5 text-text-3 hover:border-danger/50 hover:text-danger"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          );
        })}
      </CardBody>
      {total > 0 && (
        <TablePagination
          page={page}
          pageSize={size}
          total={total}
          totalPages={totalPages}
          onPageChange={onPageChange}
          onPageSizeChange={() => {}}
          pageSizes={[8, 20, 50]}
        />
      )}
    </Card>
  );
}

function CreateEventDialog({ onCreate }: { onCreate: (data: { name: string; eventDate?: string | null; endDate?: string | null; venue?: string | null; description?: string | null; deaneryName?: string | null; parishName?: string | null; organizationLevel?: "Diocese"|"Deanery"|"Parish"|"Outstation"|null }) => void }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const handleSave = (state: EventFormState, eventId: string | null) => {
    if (eventId) {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["events-analytics"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
      toast.success("Event created");
    } else {
      onCreate({
        name: state.details.name,
        eventDate: state.details.date || null,
        endDate: state.details.endDate || null,
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
                <input
                  className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-[12px] text-foreground outline-none focus:border-gold-3"
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
