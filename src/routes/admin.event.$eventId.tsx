import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill, ProgressRow } from "@/components/admin/ui-bits";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVENTS, ORGANIZATION } from "@/lib/mock-data";
import { RepeatingRows } from "@/routes/admin.events";
import { EventCheckinPanel } from "@/components/admin/event-checkin";

type Row = Record<string, string>;

export const Route = createFileRoute("/admin/event/$eventId")({
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

  const [mode, setMode] = useState<"view" | "edit">("view");
  const isEdit = mode === "edit";

  const [program, setProgram] = useState<Row[]>(
    event.program.map((p) => ({ Time: p.time, "Program activity": p.activity, "Facilitator / speaker": p.facilitator, "Talk topic": "" })),
  );
  const [duties, setDuties] = useState<Row[]>(
    event.assignments.map((a) => ({ Duty: a.role, "Assigned person / team": a.person, Area: a.area, Instructions: "" })),
  );
  const [items, setItems] = useState<Row[]>(
    event.items.map((i) => ({ "Required item": i.name, Quantity: i.quantity, Status: i.status, "Used for": "" })),
  );
  const [activities, setActivities] = useState<Row[]>(
    event.activities.map((a) => ({ Activity: a, "Responsible team": "", Location: "", Notes: "" })),
  );

  useEffect(() => {
    setProgram(event.program.map((p) => ({ Time: p.time, "Program activity": p.activity, "Facilitator / speaker": p.facilitator, "Talk topic": "" })));
    setDuties(event.assignments.map((a) => ({ Duty: a.role, "Assigned person / team": a.person, Area: a.area, Instructions: "" })));
    setItems(event.items.map((i) => ({ "Required item": i.name, Quantity: i.quantity, Status: i.status, "Used for": "" })));
    setActivities(event.activities.map((a) => ({ Activity: a, "Responsible team": "", Location: "", Notes: "" })));
  }, [event]);

  return (
    <>
      <Topbar
        title={isEdit ? "Edit Event" : "Event Detail"}
        action={
          isEdit ? (
            <div className="flex gap-2">
              <button
                onClick={() => setMode("view")}
                className="rounded-lg border border-border bg-bg-3 px-3 py-1.5 text-[11px] font-bold text-text-2"
              >
                Cancel
              </button>
              <TopbarButton onClick={() => setMode("view")}>Save Changes</TopbarButton>
            </div>
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

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHead
              title="Event Details"
              subtitle={isEdit ? "Editing core information" : "Read-only view"}
              action={<Pill tone={event.status === "done" ? "success" : "info"}>{event.status}</Pill>}
            />
            <CardBody>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Event name"><Input defaultValue={event.name} readOnly={!isEdit} /></Field>
                <Field label="Date"><Input defaultValue={event.date} readOnly={!isEdit} /></Field>
                <SelectField label="Deanery" placeholder="Select deanery" values={deaneries} disabled={!isEdit} />
                <SelectField label="Parish" placeholder={event.parish} values={parishes} disabled={!isEdit} />
                <SelectField label="Local church / outstation" placeholder="Select local" values={locals.slice(0, 24)} disabled={!isEdit} />
                <Field label="Venue"><Input defaultValue={event.venue} readOnly={!isEdit} /></Field>
                <Field label="Expected"><Input type="number" defaultValue={event.expected} readOnly={!isEdit} /></Field>
                <Field label="Registered"><Input type="number" defaultValue={event.registered} readOnly={!isEdit} /></Field>
                <Field label="Notes"><Textarea defaultValue={`${event.name} planning, attendance and reporting notes.`} readOnly={!isEdit} /></Field>
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
                <SelectField label="Find member" placeholder="Name / number" values={["CY-2026-1042", "CY-2026-0871", "Grace Wanjiku", "Peter Mwangi"]} disabled={!isEdit} />
                <SelectField label="Attendance" placeholder="Mark status" values={["In attendance", "Expected", "Absent", "Guest"]} disabled={!isEdit} />
                <button className="rounded-lg border border-info/40 bg-info-soft px-3 py-2 text-[10px] font-bold text-info">Add non-member</button>
                <button className="rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-[10px] font-bold text-success">Generate number</button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card>
            <CardHead title="Program & Activities" subtitle="Sessions, topics, and facilitators" />
            <CardBody className="space-y-2">
              {isEdit ? (
                <RepeatingRows
                  itemLabel="activity"
                  labels={["Time", "Program activity", "Facilitator / speaker", "Talk topic"]}
                  rows={program}
                  setRows={setProgram}
                />
              ) : (
                <>
                  {program.map((item, i) => (
                    <RowItem key={i} title={`${item.Time} · ${item["Program activity"]}`} meta={item["Facilitator / speaker"]} />
                  ))}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.topics.map((topic) => <Pill key={topic} tone="gold">{topic}</Pill>)}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Duties" subtitle="Who was assigned what and where" />
            <CardBody className="space-y-2">
              {isEdit ? (
                <RepeatingRows
                  itemLabel="duty"
                  labels={["Duty", "Assigned person / team", "Area", "Instructions"]}
                  rows={duties}
                  setRows={setDuties}
                />
              ) : (
                duties.map((item, i) => (
                  <RowItem key={i} title={`${item.Duty} — ${item["Assigned person / team"]}`} meta={item.Area} />
                ))
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Required Items" subtitle="Planning and actual use" />
            <CardBody className="space-y-2">
              {isEdit ? (
                <RepeatingRows
                  itemLabel="item"
                  labels={["Required item", "Quantity", "Status", "Used for"]}
                  rows={items}
                  setRows={setItems}
                />
              ) : (
                items.map((item, i) => (
                  <RowItem key={i} title={`${item["Required item"]} · ${item.Quantity}`} meta={item.Status} />
                ))
              )}
            </CardBody>
          </Card>
        </div>

        {isEdit && (
          <Card className="mt-3">
            <CardHead title="Activities" subtitle="High-level activities for this event" />
            <CardBody>
              <RepeatingRows
                itemLabel="activity"
                labels={["Activity", "Responsible team", "Location", "Notes"]}
                rows={activities}
                setRows={setActivities}
              />
            </CardBody>
          </Card>
        )}

        <Card className="mt-3">
          <CardHead title="Gallery" subtitle="Photos and evidence attached to this event" action={isEdit ? "Upload →" : undefined} />
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SelectField({ label, placeholder, values, disabled }: { label: string; placeholder: string; values: string[]; disabled?: boolean }) {
  return (
    <Field label={label}>
      <Select disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {values.map((value) => (
            <SelectItem key={value} value={value}>{value}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}