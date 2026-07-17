import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import {
  EventTabsForm,
  emptyEventState,
  type EventFormState,
  type ProgramSlot,
  type DutyCategory,
} from "@/components/admin/event-tabs-form";
import {
  getEventFull,
  type EventFull,
  type EventProgramItem,
  type EventDutyCategory,
} from "@/lib/db/events";

export const Route = createFileRoute("/admin/event/$eventId")({
  head: () => ({
    meta: [
      { title: "Event — CDM Youth Office" },
      { name: "description", content: "Event details, program, duties, attendance and reports." },
    ],
  }),
  component: EventDetailPage,
});

/* ---------- helpers: DB → form state ---------- */

const uid = () => Math.random().toString(36).slice(2, 9);

function programItemsToSlots(items: EventProgramItem[]): ProgramSlot[] {
  if (!items.length) return emptyEventState().program;
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const groups: Record<number, EventProgramItem[]> = {};
  sorted.forEach((item) => {
    const key = Math.floor(item.position / 100);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.values(groups).map((group) => ({
    id: uid(),
    startTime: group[0].start_time ?? "",
    endTime: group[0].end_time ?? "",
    activities: group.map((item) => ({ id: item.id, name: item.activity })),
  }));
}

function dbCategoriesToDuties(categories: EventDutyCategory[]): DutyCategory[] {
  if (!categories?.length) return emptyEventState().duties;
  return [...categories]
    .sort((a, b) => a.position - b.position)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      duties: [...(cat.duties ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((d) => ({
          id: d.id,
          label: d.title,
          assignments: d.assignees?.length
            ? d.assignees.map((a) => ({
                id: a.id,
                deanery: a.deanery?.name ?? "",
                parish: a.parish?.name ?? "",
                name: a.name,
                youthId: a.youth_id,
              }))
            : [{ id: uid(), deanery: "", parish: "", name: "" }],
        })),
    }));
}

const MASS_NAMES = new Set(["Readings", "Prayers of the Faithful", "Speeches"]);

function eventToFormSeed(event: EventFull): EventFormState {
  const duties = dbCategoriesToDuties(event.duty_categories);
  const isMass = duties.some((c) => MASS_NAMES.has(c.name));
  const hasDuties = event.duty_categories.length > 0;
  return {
    details: {
      name: event.name,
      date: event.event_date ?? "",
      time: "",
      venue: event.venue ?? "",
      expected: "",
      level: (event.organization_level as EventFormState["details"]["level"]) ?? "",
      deanery: event.deanery?.name ?? "",
      parish: event.parish?.name ?? "",
      description: event.description ?? "",
      posterUrl: event.poster_url ?? "",
      hasDuties,
      isMass,
    },
    program: programItemsToSlots(event.program),
    duties,
  };
}

/* ---------- page ---------- */

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();

  const { data: event, isLoading, error } = useQuery({
    queryKey: ["event-full", eventId],
    queryFn: () => getEventFull(eventId),
  });

  const [mode, setMode] = useState<"view" | "edit">("view");

  if (isLoading) {
    return (
      <>
        <Topbar title="Event" />
        <div className="flex flex-1 items-center justify-center text-[12px] text-text-3">
          Loading event…
        </div>
      </>
    );
  }

  if (error || !event) {
    return (
      <>
        <Topbar title="Event" />
        <div className="flex flex-1 items-center justify-center text-[12px] text-danger">
          Event not found or failed to load.
        </div>
      </>
    );
  }

  const registrationCount = event.registrations.length;
  const guestCount = event.registrations.filter((r) => !r.youth).length;
  const memberCount = registrationCount - guestCount;

  const seed = eventToFormSeed(event);

  return (
    <>
      <Topbar
        title={mode === "edit" ? "Edit Event" : "Event Detail"}
        action={
          mode === "edit" ? (
            <button
              onClick={() => setMode("view")}
              className="rounded-lg border border-border bg-bg-3 px-3 py-1.5 text-[11px] font-bold text-text-2"
            >
              Close editor
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/admin/event-checkin/$eventId"
                params={{ eventId }}
                className="rounded-lg bg-primary px-3.5 py-1.5 text-[11px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                Register
              </Link>
              <TopbarButton onClick={() => setMode("edit")}>Edit Event</TopbarButton>
            </div>
          )
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title={event.name}
          description={[event.event_date, event.venue, event.parish?.name ?? event.deanery?.name ?? "Diocese-wide"]
            .filter(Boolean)
            .join(" · ")}
        />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Registrations" value={String(registrationCount)} trend="total registered" tone="info" />
          <Kpi label="Members" value={String(memberCount)} trend="CDM youth" tone="up" />
          <Kpi label="Guests" value={String(guestCount)} trend="walk-in / external" tone="warn" />
          <Kpi label="Check-ins" value={String(event.checkin_count)} trend="confirmed on day" tone="up" />
        </div>

        {mode === "edit" ? (
          <Card>
            <CardHead
              title="Edit event"
              subtitle="Changes are saved to the database at each step."
              action={<Pill tone="info">editing</Pill>}
            />
            <CardBody>
              <EventTabsForm
                initial={seed}
                initialEventId={eventId}
                submitLabel="Save all changes"
                onCancel={() => setMode("view")}
                onSave={(_state, savedId) => {
                  toast.success(`Event "${event.name}" updated`);
                  if (savedId) {
                    qc.invalidateQueries({ queryKey: ["event-full", eventId] });
                    qc.invalidateQueries({ queryKey: ["events"] });
                  }
                  setMode("view");
                }}
              />
            </CardBody>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {/* Event details */}
              <Card>
                <CardHead title="Event Details" subtitle="Saved information" />
                <CardBody className="grid gap-2 md:grid-cols-2">
                  <ReadField label="Event name" value={event.name} />
                  <ReadField label="Date" value={event.event_date ?? "—"} />
                  <ReadField label="Venue" value={event.venue ?? "—"} />
                  <ReadField label="Level" value={event.organization_level ?? "—"} />
                  <ReadField label="Deanery" value={event.deanery?.name ?? "—"} />
                  <ReadField label="Parish" value={event.parish?.name ?? "—"} />
                  {event.description && (
                    <div className="md:col-span-2">
                      <ReadField label="Description" value={event.description} />
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Program */}
              <Card>
                <CardHead title="Program" subtitle="Time slots and activities" />
                <CardBody className="space-y-2">
                  {event.program.length === 0 && (
                    <p className="text-[11px] text-text-3">No program saved yet.</p>
                  )}
                  {programItemsToSlots(event.program).map((slot, i) => (
                    <div key={i} className="rounded-lg border border-border bg-bg-2 px-3 py-2">
                      <div className="text-[10px] font-bold text-gold">
                        {slot.startTime}
                        {slot.endTime ? ` – ${slot.endTime}` : ""}
                      </div>
                      {slot.activities.map((a, j) => (
                        <div key={j} className="mt-0.5 text-[11px] text-text-1">
                          {j + 1}. {a.name}
                        </div>
                      ))}
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>

            {/* Duties */}
            {event.duty_categories.length > 0 && (
              <Card className="mt-3">
                <CardHead title="Duties" subtitle="Assigned roles and persons" />
                <CardBody className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {[...event.duty_categories]
                    .sort((a, b) => a.position - b.position)
                    .map((cat) => (
                      <div key={cat.id}>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gold">
                          {cat.name}
                        </div>
                        <div className="space-y-1">
                          {[...cat.duties]
                            .sort((a, b) => a.position - b.position)
                            .map((duty) => (
                              <div key={duty.id} className="rounded-md border border-border bg-bg-2 px-2.5 py-1.5">
                                <div className="text-[10px] font-semibold text-danger">{duty.title}</div>
                                {duty.assignees.map((a) => (
                                  <div key={a.id} className="mt-0.5 text-[10px] text-text-2">
                                    {a.name}
                                    {(a.parish?.name || a.deanery?.name) && (
                                      <span className="text-text-4">
                                        {" "}· {a.parish?.name ?? a.deanery?.name}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                </CardBody>
              </Card>
            )}

          </>
        )}
      </div>
    </>
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
