import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ORGANIZATION } from "@/lib/mock-data";
import { toast } from "sonner";

/* ---------- Types ---------- */

export type EventDetails = {
  name: string;
  date: string; // ISO yyyy-mm-dd
  time: string;
  venue: string;
  expected: string;
  level: "Diocese" | "Deanery" | "Parish" | "Outstation" | "";
  deanery: string;
  parish: string;
  description: string;
};

export type ProgramActivity = { id: string; name: string };
export type ProgramSlot = {
  id: string;
  startTime: string; // "09:00"
  endTime: string; // optional "10:30" — if empty, single time
  activities: ProgramActivity[];
};

export type DutyAssignment = {
  id: string;
  deanery: string;
  parish: string;
  name: string;
};
export type DutyItem = {
  id: string;
  label: string; // e.g. "First reading"
  assignments: DutyAssignment[];
};
export type DutyCategory = {
  id: string;
  name: string; // "Readings"
  duties: DutyItem[];
};

export type EventFormState = {
  details: EventDetails;
  program: ProgramSlot[];
  duties: DutyCategory[];
};

const uid = () => Math.random().toString(36).slice(2, 9);

export const DEFAULT_DUTIES: DutyCategory[] = [
  {
    id: uid(),
    name: "Readings",
    duties: ["First reading", "Psalms", "Second reading", "Gospel"].map((label) => ({
      id: uid(),
      label,
      assignments: [{ id: uid(), deanery: "", parish: "", name: "" }],
    })),
  },
  {
    id: uid(),
    name: "Prayers of the Faithful",
    duties: ["Church", "Country", "Families", "Youth & Vocations", "Sick", "Other needs"].map((label) => ({
      id: uid(),
      label,
      assignments: [{ id: uid(), deanery: "", parish: "", name: "" }],
    })),
  },
  {
    id: uid(),
    name: "Speeches",
    duties: [
      {
        id: uid(),
        label: "Welcome speech",
        assignments: [{ id: uid(), deanery: "", parish: "", name: "" }],
      },
    ],
  },
];

export function emptyEventState(): EventFormState {
  return {
    details: {
      name: "",
      date: "",
      time: "",
      venue: "",
      expected: "",
      level: "",
      deanery: "",
      parish: "",
      description: "",
    },
    program: [
      { id: uid(), startTime: "", endTime: "", activities: [{ id: uid(), name: "" }] },
    ],
    duties: DEFAULT_DUTIES.map((c) => ({
      ...c,
      id: uid(),
      duties: c.duties.map((d) => ({
        ...d,
        id: uid(),
        assignments: d.assignments.map((a) => ({ ...a, id: uid() })),
      })),
    })),
  };
}

/* ---------- Main component ---------- */

export function EventTabsForm({
  initial,
  onSave,
  onCancel,
  submitLabel = "Save event",
}: {
  initial?: Partial<EventFormState>;
  onSave: (state: EventFormState) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const seed = useMemo(() => {
    const base = emptyEventState();
    return {
      details: { ...base.details, ...(initial?.details ?? {}) },
      program: initial?.program?.length ? initial.program : base.program,
      duties: initial?.duties?.length ? initial.duties : base.duties,
    } as EventFormState;
  }, [initial]);

  const [state, setState] = useState<EventFormState>(seed);
  const [tab, setTab] = useState<"details" | "program" | "duties">("details");

  useEffect(() => {
    setState(seed);
  }, [seed]);

  const setDetails = (patch: Partial<EventDetails>) =>
    setState((s) => ({ ...s, details: { ...s.details, ...patch } }));

  const goNext = () => {
    if (tab === "details") {
      if (!state.details.name.trim() || !state.details.date) {
        toast.error("Event name and date are required");
        return;
      }
      toast.success("Details saved");
      setTab("program");
    } else if (tab === "program") {
      toast.success("Program saved");
      setTab("duties");
    }
  };

  const saveCurrent = () => {
    toast.success(`${tab[0].toUpperCase()}${tab.slice(1)} saved`);
  };

  const handleFinalSave = () => {
    if (!state.details.name.trim() || !state.details.date) {
      toast.error("Add at least the event name and date");
      setTab("details");
      return;
    }
    onSave(state);
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="details">1 · Event Details</TabsTrigger>
        <TabsTrigger value="program">2 · Program</TabsTrigger>
        <TabsTrigger value="duties">3 · Duties</TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="mt-4">
        <DetailsTab details={state.details} onChange={setDetails} />
      </TabsContent>
      <TabsContent value="program" className="mt-4">
        <ProgramTab
          program={state.program}
          setProgram={(p) => setState((s) => ({ ...s, program: p }))}
        />
      </TabsContent>
      <TabsContent value="duties" className="mt-4">
        <DutiesTab
          duties={state.duties}
          setDuties={(d) => setState((s) => ({ ...s, duties: d }))}
        />
      </TabsContent>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={saveCurrent}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-1 hover:border-gold-3 hover:text-gold"
          >
            Save this step
          </button>
        </div>
        <div className="flex gap-2">
          {tab !== "details" && (
            <button
              type="button"
              onClick={() => setTab(tab === "duties" ? "program" : "details")}
              className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
            >
              Back
            </button>
          )}
          {tab !== "duties" ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-gold px-4 py-2 text-[11px] font-bold text-gold-foreground hover:opacity-90"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSave}
              className="rounded-lg bg-gold px-4 py-2 text-[11px] font-bold text-gold-foreground hover:opacity-90"
            >
              {submitLabel}
            </button>
          )}
        </div>
      </div>
    </Tabs>
  );
}

/* ---------- Details ---------- */

function DetailsTab({
  details,
  onChange,
}: {
  details: EventDetails;
  onChange: (patch: Partial<EventDetails>) => void;
}) {
  const parishes =
    ORGANIZATION.find((d) => d.name === details.deanery)?.parishes.map((p) => p.name) ?? [];
  const dateValue = details.date ? new Date(details.date) : undefined;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FieldLabel label="Event name *">
        <Input
          value={details.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Diocesan Youth Day"
        />
      </FieldLabel>
      <FieldLabel label="Date *">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateValue && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={(d) => onChange({ date: d ? format(d, "yyyy-MM-dd") : "" })}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </FieldLabel>
      <FieldLabel label="Time">
        <Input
          value={details.time}
          onChange={(e) => onChange({ time: e.target.value })}
          placeholder="e.g. 9:00 AM or 9:00 AM – 4:00 PM"
        />
      </FieldLabel>
      <FieldLabel label="Venue">
        <Input
          value={details.venue}
          onChange={(e) => onChange({ venue: e.target.value })}
          placeholder="Parish hall / grounds"
        />
      </FieldLabel>
      <FieldLabel label="Expected number">
        <Input
          type="number"
          value={details.expected}
          onChange={(e) => onChange({ expected: e.target.value })}
          placeholder="500"
        />
      </FieldLabel>
      <FieldLabel label="Level">
        <Select
          value={details.level}
          onValueChange={(v) =>
            onChange({ level: v as EventDetails["level"], deanery: "", parish: "" })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Diocese / Deanery / Parish / Outstation" />
          </SelectTrigger>
          <SelectContent>
            {["Diocese", "Deanery", "Parish", "Outstation"].map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldLabel>
      <FieldLabel label="Deanery (optional)">
        <Select
          value={details.deanery}
          onValueChange={(v) => onChange({ deanery: v, parish: "" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select deanery" />
          </SelectTrigger>
          <SelectContent>
            {ORGANIZATION.map((d) => (
              <SelectItem key={d.code} value={d.name}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldLabel>
      <FieldLabel label="Parish (optional)">
        <Select
          value={details.parish}
          onValueChange={(v) => onChange({ parish: v })}
          disabled={!details.deanery}
        >
          <SelectTrigger>
            <SelectValue placeholder={details.deanery ? "Select parish" : "Pick deanery first"} />
          </SelectTrigger>
          <SelectContent>
            {parishes.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldLabel>
      <div className="md:col-span-2">
        <FieldLabel label="Description">
          <Textarea
            value={details.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Purpose, theme and notes for the event"
            rows={3}
          />
        </FieldLabel>
      </div>
    </div>
  );
}

/* ---------- Program ---------- */

function ProgramTab({
  program,
  setProgram,
}: {
  program: ProgramSlot[];
  setProgram: (p: ProgramSlot[]) => void;
}) {
  const updateSlot = (id: string, patch: Partial<ProgramSlot>) =>
    setProgram(program.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSlot = (id: string) =>
    setProgram(program.length === 1 ? program : program.filter((s) => s.id !== id));
  const addSlot = () =>
    setProgram([
      ...program,
      { id: uid(), startTime: "", endTime: "", activities: [{ id: uid(), name: "" }] },
    ]);

  const addActivity = (slotId: string) =>
    setProgram(
      program.map((s) =>
        s.id === slotId ? { ...s, activities: [...s.activities, { id: uid(), name: "" }] } : s,
      ),
    );
  const updateActivity = (slotId: string, actId: string, name: string) =>
    setProgram(
      program.map((s) =>
        s.id === slotId
          ? { ...s, activities: s.activities.map((a) => (a.id === actId ? { ...a, name } : a)) }
          : s,
      ),
    );
  const removeActivity = (slotId: string, actId: string) =>
    setProgram(
      program.map((s) =>
        s.id === slotId
          ? {
              ...s,
              activities:
                s.activities.length === 1
                  ? s.activities
                  : s.activities.filter((a) => a.id !== actId),
            }
          : s,
      ),
    );

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-text-3">
        Add a time (or time range) and one or more activities for that slot. Repeat for each
        block of the program.
      </p>
      {program.map((slot, idx) => (
        <div key={slot.id} className="rounded-lg border border-border bg-bg-3 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-text-3">
              Slot #{idx + 1}
            </span>
            <button
              type="button"
              onClick={() => removeSlot(slot.id)}
              className="flex items-center gap-1 rounded-md border border-border bg-bg-2 px-2 py-1 text-[10px] font-bold text-text-2 hover:border-danger/50 hover:text-danger"
            >
              <Trash2 className="h-3 w-3" /> Remove slot
            </button>
          </div>
          <div className="mb-3 grid gap-2 md:grid-cols-[1fr_1fr_2fr]">
            <FieldLabel label="Start time">
              <Input
                value={slot.startTime}
                onChange={(e) => updateSlot(slot.id, { startTime: e.target.value })}
                placeholder="9:00 AM"
              />
            </FieldLabel>
            <FieldLabel label="End time (optional)">
              <Input
                value={slot.endTime}
                onChange={(e) => updateSlot(slot.id, { endTime: e.target.value })}
                placeholder="10:30 AM"
              />
            </FieldLabel>
            <div className="flex items-end text-[10px] text-text-3">
              {slot.startTime && (
                <span>
                  Preview:{" "}
                  <strong className="text-text-1">
                    {slot.startTime}
                    {slot.endTime ? ` – ${slot.endTime}` : ""}
                  </strong>
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-text-3">
              Activities
            </span>
            {slot.activities.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2">
                <span className="w-5 text-center text-[10px] text-text-4">{i + 1}.</span>
                <Input
                  value={a.name}
                  onChange={(e) => updateActivity(slot.id, a.id, e.target.value)}
                  placeholder="e.g. Arrival, Registration, Hymn, Procession"
                />
                <button
                  type="button"
                  onClick={() => removeActivity(slot.id, a.id)}
                  className="rounded-md p-1 text-text-3 hover:bg-bg-2 hover:text-danger"
                  aria-label="Remove activity"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addActivity(slot.id)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[10px] font-bold text-text-2 hover:border-gold-3 hover:text-gold"
            >
              <Plus className="h-3 w-3" /> Add activity
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addSlot}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2 hover:border-gold-3 hover:text-gold"
      >
        <Plus className="h-3.5 w-3.5" /> Add another time slot
      </button>
    </div>
  );
}

/* ---------- Duties ---------- */

function DutiesTab({
  duties,
  setDuties,
}: {
  duties: DutyCategory[];
  setDuties: (d: DutyCategory[]) => void;
}) {
  const updateCategory = (id: string, patch: Partial<DutyCategory>) =>
    setDuties(duties.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCategory = (id: string) =>
    setDuties(duties.length === 1 ? duties : duties.filter((c) => c.id !== id));
  const addCategory = () =>
    setDuties([
      ...duties,
      {
        id: uid(),
        name: "New category",
        duties: [
          {
            id: uid(),
            label: "New duty",
            assignments: [{ id: uid(), deanery: "", parish: "", name: "" }],
          },
        ],
      },
    ]);

  const addDuty = (catId: string) =>
    setDuties(
      duties.map((c) =>
        c.id === catId
          ? {
              ...c,
              duties: [
                ...c.duties,
                {
                  id: uid(),
                  label: "",
                  assignments: [{ id: uid(), deanery: "", parish: "", name: "" }],
                },
              ],
            }
          : c,
      ),
    );
  const updateDuty = (catId: string, dutyId: string, patch: Partial<DutyItem>) =>
    setDuties(
      duties.map((c) =>
        c.id === catId
          ? { ...c, duties: c.duties.map((d) => (d.id === dutyId ? { ...d, ...patch } : d)) }
          : c,
      ),
    );
  const removeDuty = (catId: string, dutyId: string) =>
    setDuties(
      duties.map((c) =>
        c.id === catId
          ? {
              ...c,
              duties: c.duties.length === 1 ? c.duties : c.duties.filter((d) => d.id !== dutyId),
            }
          : c,
      ),
    );

  const addAssignment = (catId: string, dutyId: string) =>
    setDuties(
      duties.map((c) =>
        c.id === catId
          ? {
              ...c,
              duties: c.duties.map((d) =>
                d.id === dutyId
                  ? {
                      ...d,
                      assignments: [
                        ...d.assignments,
                        { id: uid(), deanery: "", parish: "", name: "" },
                      ],
                    }
                  : d,
              ),
            }
          : c,
      ),
    );
  const updateAssignment = (
    catId: string,
    dutyId: string,
    assId: string,
    patch: Partial<DutyAssignment>,
  ) =>
    setDuties(
      duties.map((c) =>
        c.id === catId
          ? {
              ...c,
              duties: c.duties.map((d) =>
                d.id === dutyId
                  ? {
                      ...d,
                      assignments: d.assignments.map((a) =>
                        a.id === assId ? { ...a, ...patch } : a,
                      ),
                    }
                  : d,
              ),
            }
          : c,
      ),
    );
  const removeAssignment = (catId: string, dutyId: string, assId: string) =>
    setDuties(
      duties.map((c) =>
        c.id === catId
          ? {
              ...c,
              duties: c.duties.map((d) =>
                d.id === dutyId
                  ? {
                      ...d,
                      assignments:
                        d.assignments.length === 1
                          ? d.assignments
                          : d.assignments.filter((a) => a.id !== assId),
                    }
                  : d,
              ),
            }
          : c,
      ),
    );

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-text-3">
        Each duty can have one or more people assigned, possibly from different parishes/deaneries.
      </p>
      {duties.map((cat) => (
        <div key={cat.id} className="rounded-lg border border-border bg-bg-3 p-3">
          <div className="mb-3 flex items-center gap-2">
            <Input
              value={cat.name}
              onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
              className="font-bold"
            />
            <button
              type="button"
              onClick={() => removeCategory(cat.id)}
              className="flex items-center gap-1 rounded-md border border-border bg-bg-2 px-2 py-1 text-[10px] font-bold text-text-2 hover:border-danger/50 hover:text-danger"
            >
              <Trash2 className="h-3 w-3" /> Remove category
            </button>
          </div>
          <div className="space-y-3">
            {cat.duties.map((duty) => (
              <div key={duty.id} className="rounded-md border border-border bg-bg-2 p-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    value={duty.label}
                    onChange={(e) => updateDuty(cat.id, duty.id, { label: e.target.value })}
                    placeholder="Duty name (e.g. First reading)"
                    className="font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => removeDuty(cat.id, duty.id)}
                    className="rounded-md p-1 text-text-3 hover:bg-bg-3 hover:text-danger"
                    aria-label="Remove duty"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {duty.assignments.map((a, i) => {
                    const parishOpts =
                      ORGANIZATION.find((d) => d.name === a.deanery)?.parishes.map(
                        (p) => p.name,
                      ) ?? [];
                    return (
                      <div
                        key={a.id}
                        className="grid grid-cols-1 gap-2 rounded border border-border/50 bg-bg-3 p-2 md:grid-cols-[1fr_1fr_1.4fr_auto]"
                      >
                        <div>
                          <span className="mb-0.5 block text-[9px] font-bold uppercase text-text-4">
                            Deanery
                          </span>
                          <Select
                            value={a.deanery}
                            onValueChange={(v) =>
                              updateAssignment(cat.id, duty.id, a.id, { deanery: v, parish: "" })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Deanery" />
                            </SelectTrigger>
                            <SelectContent>
                              {ORGANIZATION.map((d) => (
                                <SelectItem key={d.code} value={d.name}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <span className="mb-0.5 block text-[9px] font-bold uppercase text-text-4">
                            Parish
                          </span>
                          <Select
                            value={a.parish}
                            onValueChange={(v) =>
                              updateAssignment(cat.id, duty.id, a.id, { parish: v })
                            }
                            disabled={!a.deanery}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={a.deanery ? "Parish" : "Pick deanery"} />
                            </SelectTrigger>
                            <SelectContent>
                              {parishOpts.map((p) => (
                                <SelectItem key={p} value={p}>
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <span className="mb-0.5 block text-[9px] font-bold uppercase text-text-4">
                            Name {i > 0 ? `#${i + 1}` : ""}
                          </span>
                          <Input
                            value={a.name}
                            onChange={(e) =>
                              updateAssignment(cat.id, duty.id, a.id, { name: e.target.value })
                            }
                            placeholder="Youth / individual responsible"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeAssignment(cat.id, duty.id, a.id)}
                            className="rounded-md p-2 text-text-3 hover:bg-bg-2 hover:text-danger"
                            aria-label="Remove person"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addAssignment(cat.id, duty.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[10px] font-bold text-text-2 hover:border-gold-3 hover:text-gold"
                  >
                    <Plus className="h-3 w-3" /> Add another person
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addDuty(cat.id)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] font-bold text-text-2 hover:border-gold-3 hover:text-gold"
            >
              <Plus className="h-3 w-3" /> Add duty in “{cat.name}”
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addCategory}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2 hover:border-gold-3 hover:text-gold"
      >
        <Plus className="h-3.5 w-3.5" /> Add another category
      </button>
    </div>
  );
}

/* ---------- shared ---------- */

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
      <span>{label}</span>
      {children}
    </label>
  );
}