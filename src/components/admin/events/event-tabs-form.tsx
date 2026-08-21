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
import { useQuery } from "@tanstack/react-query";
import { createEvent, updateEvent, saveEventProgram, saveEventDuties } from "@/lib/db/activities/events";
import { fetchOrg } from "@/lib/db/org";
import { useAdminScope } from "@/lib/hooks/use-admin-scope";
import { YouthPicker } from "@/components/admin/composables/pickers/youth-picker";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2 } from "lucide-react";

/* ---------- Types ---------- */

export type EventDetails = {
  name: string;
  date: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd — leave blank for single-day events
  time: string;
  venue: string;
  expected: string;
  level: "Diocese" | "Deanery" | "Parish" | "Outstation" | "";
  deanery: string;
  parish: string;
  /** Admin override: visible to every org scope regardless of deanery/parish. */
  openToAll: boolean;
  description: string;
  posterUrl: string;
  hasDuties: boolean;
  isMass: boolean;
};

export type ProgramActivity = { id: string; name: string };
export type ProgramSlot = {
  id: string;
  startTime: string;
  endTime: string;
  activities: ProgramActivity[];
};

export type DutyAssignment = {
  id: string;
  deanery: string;
  parish: string;
  name: string;
  youthId?: string | null;
};
export type DutyItem = {
  id: string;
  label: string;
  assignments: DutyAssignment[];
};
export type DutyCategory = {
  id: string;
  name: string;
  duties: DutyItem[];
};

export type EventFormState = {
  details: EventDetails;
  program: ProgramSlot[];
  duties: DutyCategory[];
};

const uid = () => Math.random().toString(36).slice(2, 9);

const MASS_CATEGORY_NAMES = new Set(["Readings", "Prayers of the Faithful", "Speeches"]);

export const MASS_DUTIES: DutyCategory[] = [
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
      endDate: "",
      time: "",
      venue: "",
      expected: "",
      level: "",
      deanery: "",
      parish: "",
      openToAll: false,
      description: "",
      posterUrl: "",
      hasDuties: false,
      isMass: false,
    },
    program: [
      { id: uid(), startTime: "", endTime: "", activities: [{ id: uid(), name: "" }] },
    ],
    duties: [
      {
        id: uid(),
        name: "",
        duties: [{ id: uid(), label: "", assignments: [{ id: uid(), deanery: "", parish: "", name: "" }] }],
      },
    ],
  };
}

function emptyCustomCategory(): DutyCategory {
  return {
    id: uid(),
    name: "",
    duties: [{ id: uid(), label: "", assignments: [{ id: uid(), deanery: "", parish: "", name: "" }] }],
  };
}

/* ---------- Main component ---------- */

export function EventTabsForm({
  initial,
  initialEventId,
  onSave,
  onCancel,
  submitLabel = "Save event",
}: {
  initial?: Partial<EventFormState>;
  initialEventId?: string;
  onSave: (state: EventFormState, eventId: string | null) => void;
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
  const [draftEventId, setDraftEventId] = useState<string | null>(initialEventId ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setState(seed);
  }, [seed]);

  const setDetails = (patch: Partial<EventDetails>) =>
    setState((s) => {
      const newDetails = { ...s.details, ...patch };
      let newDuties = s.duties;

      if ("isMass" in patch) {
        if (patch.isMass) {
          const custom = s.duties.filter((c) => !MASS_CATEGORY_NAMES.has(c.name));
          newDuties = [...freshMassDuties(), ...custom];
        } else {
          const custom = s.duties.filter((c) => !MASS_CATEGORY_NAMES.has(c.name));
          newDuties = custom.length > 0 ? custom : [emptyCustomCategory()];
        }
      }

      if ("hasDuties" in patch && !patch.hasDuties) {
        newDetails.isMass = false;
        newDuties = [emptyCustomCategory()];
      }

      return { ...s, details: newDetails, duties: newDuties };
    });

  const detailsInput = () => ({
    name: state.details.name,
    eventDate: state.details.date || null,
    endDate: state.details.endDate || null,
    venue: state.details.venue || null,
    description: state.details.description || null,
    posterUrl: state.details.posterUrl || null,
    organizationLevel: (state.details.level || null) as "Diocese" | "Deanery" | "Parish" | "Outstation" | null,
    deaneryName: state.details.deanery || null,
    parishName: state.details.parish || null,
    openToAll: state.details.openToAll,
  });

  const ensureEventSaved = async (): Promise<string> => {
    const input = detailsInput();
    if (!draftEventId) {
      const ev = await createEvent(input);
      setDraftEventId(ev.id);
      return ev.id;
    }
    await updateEvent(draftEventId, input);
    return draftEventId;
  };

  const goNext = async () => {
    if (tab === "details") {
      if (!state.details.name.trim()) {
        toast.error("Event name is required to save");
        return;
      }
      setSaving(true);
      try {
        await ensureEventSaved();
        toast.success("Details saved");
        setTab("program");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    } else if (tab === "program") {
      setSaving(true);
      try {
        if (draftEventId) {
          await saveEventProgram(draftEventId, state.program);
        }
        toast.success("Program saved");
        setTab("duties");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }
  };

  const saveCurrent = async () => {
    setSaving(true);
    try {
      if (tab === "details") {
        if (!state.details.name.trim()) {
          toast.error("Event name is required");
          return;
        }
        await ensureEventSaved();
        toast.success("Details saved");
      } else if (tab === "program") {
        if (!draftEventId) {
          toast.info("Go back and save Details first");
          return;
        }
        await saveEventProgram(draftEventId, state.program);
        toast.success("Program saved");
      } else if (tab === "duties") {
        if (!draftEventId) {
          toast.info("Go back and save Details first");
          return;
        }
        await saveEventDuties(draftEventId, state.duties);
        toast.success("Duties saved");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalSave = async () => {
    if (!state.details.name.trim()) {
      toast.error("Add at least the event name");
      setTab("details");
      return;
    }
    setSaving(true);
    try {
      const eventId = await ensureEventSaved();
      await saveEventProgram(eventId, state.program);
      await saveEventDuties(eventId, state.duties);
      onSave(state, eventId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
      <TabsList className="grid w-full grid-cols-3 bg-white border border-gray-200 h-auto p-0.5 gap-0.5">
        <TabsTrigger
          value="details"
          className="data-[state=active]:bg-danger data-[state=active]:text-white data-[state=active]:shadow-none rounded font-bold text-[11px]"
        >
          1 · Event Details
        </TabsTrigger>
        <TabsTrigger
          value="program"
          className="data-[state=active]:bg-danger data-[state=active]:text-white data-[state=active]:shadow-none rounded font-bold text-[11px]"
        >
          2 · Program
        </TabsTrigger>
        <TabsTrigger
          value="duties"
          className="data-[state=active]:bg-danger data-[state=active]:text-white data-[state=active]:shadow-none rounded font-bold text-[11px]"
        >
          {state.details.hasDuties ? "3 · Duties" : "3 · Activities"}
        </TabsTrigger>
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
          hasDuties={state.details.hasDuties}
          setDuties={(d) => setState((s) => ({ ...s, duties: d }))}
        />
      </TabsContent>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-border bg-white px-3 py-2 text-[11px] font-bold text-text-2 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={saveCurrent}
            disabled={saving}
            className="rounded-lg border border-gold-3 px-3 py-2 text-[11px] font-bold text-gold hover:bg-gold/10 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save this step"}
          </button>
        </div>
        <div className="flex gap-2">
          {tab !== "details" && (
            <button
              type="button"
              onClick={() => setTab(tab === "duties" ? "program" : "details")}
              disabled={saving}
              className="rounded-lg border border-border bg-white px-3 py-2 text-[11px] font-bold text-text-2 disabled:opacity-50"
            >
              ← Back
            </button>
          )}
          {tab !== "duties" ? (
            <button
              type="button"
              onClick={goNext}
              disabled={saving}
              className="rounded-lg bg-danger px-4 py-2 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Next →"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSave}
              disabled={saving}
              className="rounded-lg bg-danger px-4 py-2 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : submitLabel}
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
  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg, staleTime: Infinity });
  const scope = useAdminScope();

  const parishes =
    details.deanery && org ? (org.parishesByDeaneryName.get(details.deanery) ?? []).map((p) => p.name) : [];
  const dateValue = details.date ? new Date(details.date) : undefined;

  /* ── scope lock: hide deanery/parish once the caller's scope determines them ── */
  const scopeDeaneryName = scope.deaneryId ? org?.deaneries.find((d) => d.id === scope.deaneryId)?.name : undefined;
  const scopeParishName = scope.parishId ? org?.parishes.find((p) => p.id === scope.parishId)?.name : undefined;
  const currentDeaneryId = details.deanery ? org?.byDeaneryName.get(details.deanery)?.id : undefined;
  const currentParishId = details.parish ? org?.parishes.find((p) => p.name === details.parish)?.id : undefined;
  const deaneryMismatched = !!(scope.deaneryId && currentDeaneryId && currentDeaneryId !== scope.deaneryId);
  const parishMismatched = !!(scope.parishId && currentParishId && currentParishId !== scope.parishId);
  const deaneryLocked = !!scope.deaneryId && !deaneryMismatched;
  const parishLocked = !!scope.parishId && !parishMismatched;

  useEffect(() => {
    const patch: Partial<EventDetails> = {};
    if (deaneryLocked && scopeDeaneryName && details.deanery !== scopeDeaneryName) {
      patch.deanery = scopeDeaneryName;
      patch.parish = parishLocked && scopeParishName ? scopeParishName : "";
    } else if (parishLocked && scopeParishName && details.parish !== scopeParishName) {
      patch.parish = scopeParishName;
    }
    if (Object.keys(patch).length) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deaneryLocked, parishLocked, scopeDeaneryName, scopeParishName, details.deanery, details.parish]);

  /* Level options — a scoped user can't create/edit an event above their own org tier */
  const baseLevels = scope.outstationId
    ? ["Outstation"]
    : scope.parishId
      ? ["Parish", "Outstation"]
      : scope.deaneryId
        ? ["Deanery", "Parish", "Outstation"]
        : ["Diocese", "Deanery", "Parish", "Outstation"];
  const levelOptions =
    details.level && !baseLevels.includes(details.level) ? [details.level, ...baseLevels] : baseLevels;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FieldLabel label="Event name *">
        <Input
          value={details.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Diocesan Youth Day"
        />
      </FieldLabel>
      <FieldLabel label="Start date *">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start bg-white text-left font-normal text-black",
                !dateValue && "text-gray-300",
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
      <FieldLabel label="End date (multi-day events only)">
        {(() => {
          const endVal = details.endDate ? new Date(details.endDate + "T12:00:00") : undefined;
          return (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start bg-white text-left font-normal text-black",
                    !endVal && "text-gray-300",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endVal ? format(endVal, "PPP") : <span>Same day (leave blank)</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endVal}
                  onSelect={(d) => onChange({ endDate: d ? format(d, "yyyy-MM-dd") : "" })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          );
        })()}
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
            onChange({
              level: v as EventDetails["level"],
              deanery: deaneryLocked ? details.deanery : "",
              parish: parishLocked ? details.parish : "",
              // Diocese-level only reaches every scope once "open to all" is on too —
              // default it on here so picking "Diocese" doesn't silently stay scoped.
              openToAll: v === "Diocese" ? true : details.openToAll,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Diocese / Deanery / Parish / Outstation" />
          </SelectTrigger>
          <SelectContent>
            {levelOptions.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldLabel>
      {!deaneryLocked && (
        <FieldLabel label="Deanery (optional)">
          <Select
            value={details.deanery}
            onValueChange={(v) => onChange({ deanery: v, parish: "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select deanery" />
            </SelectTrigger>
            <SelectContent>
              {(org?.deaneries ?? []).map((d) => (
                <SelectItem key={d.id} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldLabel>
      )}
      {!parishLocked && (
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
      )}
      <div className="md:col-span-2">
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-bg-2 px-3 py-2.5">
          <input
            type="checkbox"
            checked={details.openToAll}
            onChange={(e) => onChange({ openToAll: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-danger"
          />
          <span>
            <span className="block text-[11px] font-bold text-text-1">Open to all deaneries/parishes</span>
            <span className="block text-[10px] text-text-3">
              Visible and open for registration to every scope, even outside its own deanery/parish
              — use this for a diocesan event hosted by one office that other reps still need to
              register people for.
            </span>
          </span>
        </label>
      </div>
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
      <div className="md:col-span-2">
        <FieldLabel label="Poster (shown on the Youth Portal)">
          <PosterUpload value={details.posterUrl} onChange={(url) => onChange({ posterUrl: url })} />
        </FieldLabel>
      </div>
      <div className="md:col-span-2">
        <div className="flex flex-wrap items-center gap-5 rounded-lg border border-border bg-bg-2 px-3 py-2.5">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={details.hasDuties}
              onChange={(e) => onChange({ hasDuties: e.target.checked })}
              className="h-4 w-4 accent-danger"
            />
            <span className="text-[11px] font-bold text-text-1">Has duties / activities</span>
          </label>
          {details.hasDuties && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={details.isMass}
                onChange={(e) => onChange({ isMass: e.target.checked })}
                className="h-4 w-4 accent-danger"
              />
              <span className="text-[11px] font-bold text-text-1">This is a Mass event</span>
            </label>
          )}
          {!details.hasDuties && (
            <span className="ml-auto text-[10px] text-text-3">
              Tab 3: simple steps list — name each section (e.g. Agenda, Notes)
            </span>
          )}
          {details.hasDuties && !details.isMass && (
            <span className="ml-auto text-[10px] text-text-3">
              Tab 3: add duty categories and assign people by name / parish
            </span>
          )}
          {details.hasDuties && details.isMass && (
            <span className="ml-auto text-[10px] text-text-3">
              Tab 3: Readings · Prayers of the Faithful · Speeches pre-filled
            </span>
          )}
        </div>
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
        <div key={slot.id} className="rounded-lg border border-border bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-danger">
              Slot #{idx + 1}
            </span>
            <button
              type="button"
              onClick={() => removeSlot(slot.id)}
              className="flex items-center gap-1 rounded-md border border-border bg-gray-50 px-2 py-1 text-[10px] font-bold text-text-2 hover:border-danger/50 hover:text-danger"
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
            <span className="text-[10px] font-bold uppercase tracking-wide text-gold-3">
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
                  className="rounded-md p-1 text-text-3 hover:bg-gray-100 hover:text-danger"
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
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-white px-3 py-2 text-[11px] font-bold text-text-2 hover:border-gold-3 hover:text-gold"
      >
        <Plus className="h-3.5 w-3.5" /> Add another time slot
      </button>
    </div>
  );
}

/* ---------- Duties ---------- */

function freshMassDuties(): DutyCategory[] {
  return MASS_DUTIES.map((c) => ({
    ...c,
    id: uid(),
    duties: c.duties.map((d) => ({
      ...d,
      id: uid(),
      assignments: d.assignments.map((a) => ({ ...a, id: uid() })),
    })),
  }));
}

function DutiesTab({
  duties,
  setDuties,
  hasDuties,
}: {
  duties: DutyCategory[];
  setDuties: (d: DutyCategory[]) => void;
  hasDuties: boolean;
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
        name: "",
        duties: [
          {
            id: uid(),
            label: "",
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

  if (!hasDuties) {
    return (
      <div className="space-y-2">
        {duties.map((cat) => (
          <div key={cat.id} className="rounded-lg border border-border bg-white p-2">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Input
                value={cat.name}
                onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
                placeholder="Step name (e.g. Agenda, Discussion, Notes)"
                className="h-7 text-[11px] font-bold"
              />
              <button
                type="button"
                onClick={() => removeCategory(cat.id)}
                className="shrink-0 rounded p-1 text-text-3 hover:bg-gray-100 hover:text-danger"
                aria-label="Remove step"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1 border-l-2 border-border pl-2">
              {cat.duties.map((duty, i) => (
                <div key={duty.id} className="flex items-center gap-1">
                  <span className="w-4 shrink-0 text-center text-[9px] text-text-4">{i + 1}.</span>
                  <Input
                    value={duty.label}
                    onChange={(e) => updateDuty(cat.id, duty.id, { label: e.target.value })}
                    placeholder="Item…"
                    className="h-7 text-[10px]"
                  />
                  <button
                    type="button"
                    onClick={() => removeDuty(cat.id, duty.id)}
                    className="shrink-0 rounded p-0.5 text-text-3 hover:bg-gray-100 hover:text-danger"
                    aria-label="Remove item"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addDuty(cat.id)}
                className="mt-0.5 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-bold text-text-3 hover:text-gold"
              >
                <Plus className="h-2.5 w-2.5" /> add item
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addCategory}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-white px-3 py-2 text-[11px] font-bold text-text-2 hover:border-gold-3 hover:text-gold"
        >
          <Plus className="h-3.5 w-3.5" /> Add another step
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {duties.map((cat) => (
        <div key={cat.id} className="rounded-lg border border-border bg-white p-2">
          {/* Category name + remove */}
          <div className="mb-1.5 flex items-center gap-1.5">
            <Input
              value={cat.name}
              onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
              placeholder="Category name (e.g. Readings, Agenda, Teams)"
              className="h-7 text-[11px] font-bold"
            />
            <button
              type="button"
              onClick={() => removeCategory(cat.id)}
              className="shrink-0 rounded p-1 text-text-3 hover:bg-gray-100 hover:text-danger"
              aria-label="Remove category"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Duties */}
          <div className="space-y-1.5 border-l-2 border-border pl-2">
            {cat.duties.map((duty) => (
              <div key={duty.id} className="rounded border border-border/60 bg-gray-50 p-1.5">
                {/* Duty label */}
                <div className="mb-1 flex items-center gap-1">
                  <Input
                    value={duty.label}
                    onChange={(e) => updateDuty(cat.id, duty.id, { label: e.target.value })}
                    placeholder="Duty / role (e.g. First reading, Welcome speech)"
                    className="h-6 text-[11px] font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => removeDuty(cat.id, duty.id)}
                    className="shrink-0 rounded p-0.5 text-text-3 hover:bg-white hover:text-danger"
                    aria-label="Remove duty"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {/* Assignments — compact inline rows */}
                <div className="space-y-1">
                  {duty.assignments.map((a) => {
                    const parishOpts =
                      ORGANIZATION.find((d) => d.name === a.deanery)?.parishes.map((p) => p.name) ?? [];
                    return (
                      <div key={a.id} className="flex items-center gap-1">
                        <Select
                          value={a.deanery}
                          onValueChange={(v) =>
                            updateAssignment(cat.id, duty.id, a.id, { deanery: v, parish: "" })
                          }
                        >
                          <SelectTrigger className="h-7 text-[10px]">
                            <SelectValue placeholder="Deanery" />
                          </SelectTrigger>
                          <SelectContent>
                            {ORGANIZATION.map((d) => (
                              <SelectItem key={d.code} value={d.name}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={a.parish}
                          onValueChange={(v) =>
                            updateAssignment(cat.id, duty.id, a.id, { parish: v })
                          }
                          disabled={!a.deanery}
                        >
                          <SelectTrigger className="h-7 text-[10px]">
                            <SelectValue placeholder="Parish" />
                          </SelectTrigger>
                          <SelectContent>
                            {parishOpts.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={a.name}
                          onChange={(e) =>
                            updateAssignment(cat.id, duty.id, a.id, { name: e.target.value })
                          }
                          placeholder="Name"
                          className="h-7 text-[10px]"
                          disabled={!!a.youthId}
                        />
                        <YouthPicker
                          value={a.youthId ?? null}
                          linkedName={a.name}
                          onChange={(youth) =>
                            updateAssignment(cat.id, duty.id, a.id, {
                              youthId: youth?.id ?? null,
                              name: youth ? youth.full_name : a.name,
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => removeAssignment(cat.id, duty.id, a.id)}
                          className="shrink-0 rounded p-1 text-text-3 hover:bg-gray-100 hover:text-danger"
                          aria-label="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => addAssignment(cat.id, duty.id)}
                  className="mt-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-bold text-text-3 hover:text-gold"
                >
                  <Plus className="h-2.5 w-2.5" /> add person
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addDuty(cat.id)}
              className="inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-0.5 text-[10px] font-bold text-text-3 hover:border-gold-3 hover:text-gold"
            >
              <Plus className="h-3 w-3" /> add duty
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addCategory}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-white px-3 py-2 text-[11px] font-bold text-text-2 hover:border-gold-3 hover:text-gold"
      >
        <Plus className="h-3.5 w-3.5" /> Add another category
      </button>
    </div>
  );
}

/* ---------- Poster upload ---------- */

function PosterUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Poster image must be under 8MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("events").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("events").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Poster uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-2 normal-case tracking-normal">
      {value ? (
        <img src={value} alt="Event poster" className="h-16 w-24 rounded-md border border-border object-cover" />
      ) : (
        <div className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed border-border bg-bg-3 text-text-4">
          <Upload className="h-5 w-5" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1.5">
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-[11px] font-bold text-text-1 hover:bg-bg-4">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : value ? "Replace poster" : "Upload poster"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex w-fit items-center gap-1 text-[10px] font-semibold text-text-3 hover:text-danger"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
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
