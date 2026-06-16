import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, QrCode, Search, UserPlus, X, BadgeCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/admin/topbar";
import { getEventFull } from "@/lib/db/events";
import { listYouths, type YouthRow } from "@/lib/db/youths";
import { ORGANIZATION } from "@/lib/mock-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/event-checkin/$eventId")({
  head: () => ({
    meta: [
      { title: "Registrations & Check-in — CDM Youth Office" },
      { name: "description", content: "Manage event registrations and day-of check-in." },
    ],
  }),
  component: EventCheckinPage,
});

type AttendeeKind = "member" | "guest";
type AttendeeEntry = {
  id: string;
  cdmId: string;
  name: string;
  phone: string;
  deanery: string;
  parish: string;
  outstation: string;
  time: string;
  kind: AttendeeKind;
};

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function youthToEntry(y: YouthRow): AttendeeEntry {
  return {
    id: y.id,
    cdmId: y.cdm_id,
    name: y.full_name,
    phone: y.phone ?? "",
    deanery: y.deanery?.name ?? "",
    parish: y.parish?.name ?? "",
    outstation: y.outstation?.name ?? "",
    time: nowTime(),
    kind: "member",
  };
}

function selectCls(extra = "") {
  return `h-8 rounded-md border border-border bg-bg-2 px-2 text-[11px] font-medium text-text-1 outline-none transition hover:border-gold-3 focus:border-gold-3 ${extra}`;
}
function btnCls(variant: "primary" | "ghost" = "primary", extra = "") {
  const base = "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-bold transition";
  const vars = {
    primary: "bg-danger text-white hover:opacity-90",
    ghost: "border border-border bg-bg-2 text-text-2 hover:text-text-1",
  };
  return `${base} ${vars[variant]} ${extra}`;
}

/* ─── main page ─── */
function EventCheckinPage() {
  const { eventId } = Route.useParams();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event-full", eventId],
    queryFn: () => getEventFull(eventId),
  });
  const { data: allYouths = [] } = useQuery({
    queryKey: ["youths"],
    queryFn: listYouths,
  });

  const youthByCdm = useMemo(() => {
    const m: Record<string, YouthRow> = {};
    allYouths.forEach((y) => { m[y.cdm_id] = y; });
    return m;
  }, [allYouths]);

  const [attendees, setAttendees] = useState<AttendeeEntry[]>([]);

  useEffect(() => {
    if (!event) return;
    setAttendees(
      event.registrations.map((reg) => {
        const cdm = reg.youth?.cdm_id ?? "";
        const yFull = cdm ? youthByCdm[cdm] : null;
        return {
          id: reg.id,
          cdmId: cdm || "—",
          name: reg.youth?.full_name ?? reg.guest_name ?? "—",
          phone: yFull?.phone ?? "",
          deanery: yFull?.deanery?.name ?? "",
          parish: reg.youth?.parish?.name ?? yFull?.parish?.name ?? "",
          outstation: yFull?.outstation?.name ?? "",
          time: new Date(reg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          kind: reg.youth ? "member" : "guest",
        };
      }),
    );
  }, [event, youthByCdm]);

  /* page-level filters */
  const [deanery, setDeanery] = useState("");
  const [parish, setParish] = useState("");
  const [outstation, setOutstation] = useState("");
  const [q, setQ] = useState("");

  /* dialog state */
  const [registerOpen, setRegisterOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  /* cascading filter options */
  const deaneryOptions = ORGANIZATION.map((d) => d.name);
  const parishOptions = useMemo(() => {
    const scope = deanery
      ? ORGANIZATION.find((d) => d.name === deanery)?.parishes ?? []
      : ORGANIZATION.flatMap((d) => d.parishes);
    return [...new Set(scope.map((p) => p.name))];
  }, [deanery]);
  const outstationOptions = useMemo(() => {
    const parishes = deanery
      ? (ORGANIZATION.find((d) => d.name === deanery)?.parishes ?? [])
      : ORGANIZATION.flatMap((d) => d.parishes);
    const scope = parish ? parishes.filter((p) => p.name === parish) : parishes;
    return [...new Set(scope.flatMap((p) => p.churches.map((c) => c.name)))];
  }, [deanery, parish]);

  /* filtered attendees */
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return attendees.filter((a) => {
      if (deanery && a.deanery !== deanery) return false;
      if (parish && a.parish !== parish) return false;
      if (outstation && a.outstation !== outstation) return false;
      if (term && ![a.name, a.cdmId, a.phone, a.parish, a.outstation].join(" ").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [attendees, deanery, parish, outstation, q]);

  const addAttendee = (entry: AttendeeEntry) => {
    setAttendees((prev) => {
      const dup = prev.some(
        (a) => a.id === entry.id || (entry.cdmId !== "—" && a.cdmId === entry.cdmId),
      );
      if (dup) { toast.message(`${entry.name} is already registered`); return prev; }
      toast.success(`${entry.name} registered`);
      return [entry, ...prev];
    });
  };

  const removeAttendee = (id: string) => setAttendees((prev) => prev.filter((a) => a.id !== id));

  if (isLoading || !event) {
    return (
      <>
        <Topbar title="Registrations & Check-in" />
        <div className="flex flex-1 items-center justify-center text-[12px] text-text-3">
          {isLoading ? "Loading…" : "Event not found."}
        </div>
      </>
    );
  }

  const memberCount = attendees.filter((a) => a.kind === "member").length;
  const guestCount = attendees.filter((a) => a.kind === "guest").length;

  return (
    <>
      <Topbar
        title={event.name}
        description="Registrations & Check-in"
        action={
          <Link
            to="/admin/event/$eventId"
            params={{ eventId }}
            className={btnCls("ghost")}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to event
          </Link>
        }
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── filter + action bar ── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-2 px-4 py-2.5">
          <select
            value={deanery}
            onChange={(e) => { setDeanery(e.target.value); setParish(""); setOutstation(""); }}
            className={selectCls("max-w-[160px]")}
          >
            <option value="">All Deaneries</option>
            {deaneryOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            value={parish}
            onChange={(e) => { setParish(e.target.value); setOutstation(""); }}
            className={selectCls("max-w-[160px]")}
          >
            <option value="">All Parishes</option>
            {parishOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select
            value={outstation}
            onChange={(e) => setOutstation(e.target.value)}
            className={selectCls("max-w-[160px]")}
          >
            <option value="">All Outstations</option>
            {outstationOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>

          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, CDM No., phone…"
              className="h-8 w-full rounded-md border border-border bg-white pl-8 pr-7 text-[11px] text-black/70 placeholder:text-gray-400 outline-none transition hover:border-gold-3/50 focus:border-gold-3"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-3 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {(deanery || parish || outstation || q) && (
            <button
              onClick={() => { setDeanery(""); setParish(""); setOutstation(""); setQ(""); }}
              className="text-[10px] font-semibold text-text-3 hover:text-danger"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setRegisterOpen(true)} className={btnCls("primary")}>
              <BadgeCheck className="h-3.5 w-3.5" /> Register
            </button>
            <button onClick={() => setWalkInOpen(true)} className={btnCls("primary")}>
              <UserPlus className="h-3.5 w-3.5" /> Walk-in
            </button>
            <button onClick={() => setScanOpen(true)} className={btnCls("ghost")}>
              <QrCode className="h-3.5 w-3.5" /> Show QR
            </button>
          </div>
        </div>

        {/* ── stats bar ── */}
        <div className="flex items-center gap-4 border-b border-border bg-card px-4 py-1.5 text-[11px] text-text-3">
          <span><span className="font-bold text-text-1">{attendees.length}</span> registered</span>
          <span><span className="font-bold text-text-1">{memberCount}</span> members</span>
          <span><span className="font-bold text-text-1">{guestCount}</span> guests</span>
          {filtered.length !== attendees.length && (
            <span className="text-gold">· showing {filtered.length} after filters</span>
          )}
        </div>

        {/* ── attendance table ── */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
              <tr className="text-left text-[9px] font-bold uppercase tracking-wide text-text-3">
                <th className="px-3 py-2.5">CDM No.</th>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Phone</th>
                <th className="px-3 py-2.5">Deanery</th>
                <th className="px-3 py-2.5">Parish</th>
                <th className="px-3 py-2.5">Outstation</th>
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-[12px] text-text-3">
                    {attendees.length === 0
                      ? "No registrations yet — use Register, Walk-in, or Scan to add attendees."
                      : "No attendees match the current filters."}
                  </td>
                </tr>
              )}
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-bg-2">
                  <td className="px-3 py-2 font-mono text-[10px] text-text-3">{a.cdmId}</td>
                  <td className="px-3 py-2 font-semibold text-text-1">
                    {a.name}
                    {a.kind === "guest" && (
                      <span className="ml-1.5 rounded bg-warn-soft px-1 py-0.5 text-[8px] font-black uppercase tracking-wide text-gold">
                        guest
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-3">{a.phone || "—"}</td>
                  <td className="px-3 py-2 text-text-3">{a.deanery || "—"}</td>
                  <td className="px-3 py-2 text-text-3">{a.parish || "—"}</td>
                  <td className="px-3 py-2 text-text-3">{a.outstation || "—"}</td>
                  <td className="px-3 py-2 text-text-4">{a.time}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeAttendee(a.id)}
                      className="rounded p-0.5 text-text-4 hover:bg-danger-soft hover:text-danger"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── dialogs ── */}
      <RegisterDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        allYouths={allYouths}
        youthByCdm={youthByCdm}
        defaultDeanery={deanery}
        defaultParish={parish}
        defaultOutstation={outstation}
        onAdd={addAttendee}
      />
      <WalkInDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        onAdd={addAttendee}
      />
      <ScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        eventId={eventId}
        eventName={event.name}
      />
    </>
  );
}

/* ─── Register dialog ─── */
function RegisterDialog({
  open, onClose, allYouths, youthByCdm, defaultDeanery, defaultParish, defaultOutstation, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  allYouths: YouthRow[];
  youthByCdm: Record<string, YouthRow>;
  defaultDeanery: string;
  defaultParish: string;
  defaultOutstation: string;
  onAdd: (e: AttendeeEntry) => void;
}) {
  const [mode, setMode] = useState<"cdm" | "browse">("cdm");

  /* CDM mode */
  const [cdmInput, setCdmInput] = useState("");
  const [preview, setPreview] = useState<YouthRow | null>(null);
  const [cdmError, setCdmError] = useState("");

  const lookupCdm = () => {
    const key = cdmInput.trim().toUpperCase();
    const y = youthByCdm[key];
    if (y) { setPreview(y); setCdmError(""); }
    else { setPreview(null); setCdmError(`No youth found with CDM No. "${cdmInput.trim()}"`); }
  };

  /* Browse mode */
  const [bDeanery, setBDeanery] = useState(defaultDeanery);
  const [bParish, setBParish] = useState(defaultParish);
  const [bOutstation, setBOutstation] = useState(defaultOutstation);
  const [bSearch, setBSearch] = useState("");

  useEffect(() => {
    if (open) { setBDeanery(defaultDeanery); setBParish(defaultParish); setBOutstation(defaultOutstation); }
  }, [open, defaultDeanery, defaultParish, defaultOutstation]);

  const browseParishes = useMemo(() => {
    const scope = bDeanery
      ? ORGANIZATION.find((d) => d.name === bDeanery)?.parishes ?? []
      : ORGANIZATION.flatMap((d) => d.parishes);
    return [...new Set(scope.map((p) => p.name))];
  }, [bDeanery]);

  const browseOutstations = useMemo(() => {
    const parishes = bDeanery
      ? (ORGANIZATION.find((d) => d.name === bDeanery)?.parishes ?? [])
      : ORGANIZATION.flatMap((d) => d.parishes);
    const scope = bParish ? parishes.filter((p) => p.name === bParish) : parishes;
    return [...new Set(scope.flatMap((p) => p.churches.map((c) => c.name)))];
  }, [bDeanery, bParish]);

  const browseResults = useMemo(() => {
    const term = bSearch.trim().toLowerCase();
    if (!term) return [];
    return allYouths
      .filter((y) => {
        if (bDeanery && y.deanery?.name !== bDeanery) return false;
        if (bParish && y.parish?.name !== bParish) return false;
        if (bOutstation && y.outstation?.name !== bOutstation) return false;
        if (![y.full_name, y.cdm_id].join(" ").toLowerCase().includes(term)) return false;
        return true;
      })
      .slice(0, 50);
  }, [allYouths, bDeanery, bParish, bOutstation, bSearch]);

  const reset = () => {
    setCdmInput(""); setPreview(null); setCdmError(""); setBSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Register Attendee</DialogTitle>
        </DialogHeader>

        {/* mode tabs */}
        <div className="flex gap-1 rounded-lg border border-border bg-bg-2 p-0.5">
          {(["cdm", "browse"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); reset(); }}
              className={`flex-1 rounded-md py-1.5 text-[11px] font-bold transition ${
                mode === m ? "bg-danger text-white" : "text-text-2 hover:text-text-1"
              }`}
            >
              {m === "cdm" ? "By CDM No." : "Browse by location"}
            </button>
          ))}
        </div>

        {/* CDM mode */}
        {mode === "cdm" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={cdmInput}
                onChange={(e) => { setCdmInput(e.target.value); setPreview(null); setCdmError(""); }}
                onKeyDown={(e) => e.key === "Enter" && lookupCdm()}
                placeholder="CDM-2026-00001"
                className="flex-1"
              />
              <button onClick={lookupCdm} className={btnCls("primary")}>
                <Search className="h-3.5 w-3.5" /> Look up
              </button>
            </div>
            {cdmError && <p className="text-[11px] text-danger">{cdmError}</p>}
            {preview && (
              <div className="rounded-lg border border-border bg-bg-2 p-3 space-y-1">
                <div className="font-bold text-[13px] text-text-1">{preview.full_name}</div>
                <div className="text-[11px] text-text-3">
                  {preview.cdm_id} · {preview.parish?.name ?? "—"} · {preview.category}
                </div>
                {preview.phone && <div className="text-[11px] text-text-3">{preview.phone}</div>}
                <button
                  onClick={() => { onAdd(youthToEntry(preview)); reset(); onClose(); }}
                  className={btnCls("primary", "mt-2")}
                >
                  <BadgeCheck className="h-3.5 w-3.5" /> Register
                </button>
              </div>
            )}
          </div>
        )}

        {/* Browse mode */}
        {mode === "browse" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <select
                value={bDeanery}
                onChange={(e) => { setBDeanery(e.target.value); setBParish(""); setBOutstation(""); }}
                className={selectCls("flex-1 min-w-[120px]")}
              >
                <option value="">All Deaneries</option>
                {ORGANIZATION.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
              <select
                value={bParish}
                onChange={(e) => { setBParish(e.target.value); setBOutstation(""); }}
                className={selectCls("flex-1 min-w-[120px]")}
              >
                <option value="">All Parishes</option>
                {browseParishes.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={bOutstation}
                onChange={(e) => setBOutstation(e.target.value)}
                className={selectCls("flex-1 min-w-[120px]")}
              >
                <option value="">All Outstations</option>
                {browseOutstations.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-4" />
              <Input
                value={bSearch}
                onChange={(e) => setBSearch(e.target.value)}
                placeholder="Search name or CDM No."
                className="pl-8"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {!bSearch.trim() ? (
                <div className="p-4 text-center text-[11px] text-text-3">
                  Type a name or CDM No. above to search
                  {(bDeanery || bParish || bOutstation) && " within the selected location"}.
                </div>
              ) : browseResults.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-text-3">
                  No youth found — try a different name or widen the location filters.
                </div>
              ) : (
                browseResults.map((y) => (
                  <div key={y.id} className="flex items-center gap-2 px-3 py-2 hover:bg-bg-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-text-1">{y.full_name}</div>
                      <div className="text-[10px] text-text-3">
                        {y.cdm_id} · {y.outstation?.name ?? y.parish?.name ?? "—"}
                      </div>
                    </div>
                    <button
                      onClick={() => { onAdd(youthToEntry(y)); }}
                      className={btnCls("primary", "shrink-0")}
                    >
                      Register
                    </button>
                  </div>
                ))
              )}
            </div>
            {bSearch.trim() && browseResults.length > 0 && (
              <p className="text-[10px] text-text-3">
                {browseResults.length === 50
                  ? "Showing first 50 — narrow the name or location to see fewer."
                  : `${browseResults.length} result${browseResults.length !== 1 ? "s" : ""}.`}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Walk-in dialog ─── */
function WalkInDialog({
  open, onClose, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (e: AttendeeEntry) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");

  const reset = () => { setName(""); setPhone(""); setArea(""); };

  const submit = () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    onAdd({
      id: `guest-${Date.now()}`,
      cdmId: "—",
      name: name.trim(),
      phone: phone.trim(),
      deanery: "",
      parish: area.trim(),
      outstation: "",
      time: nowTime(),
      kind: "guest",
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Walk-in Guest</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-text-3">Full name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Kamau" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-text-3">Phone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254700000000" type="tel" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-text-3">Parish / Area</label>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Cathedral Parish" />
          </div>
          <button onClick={submit} className={btnCls("primary", "w-full justify-center")}>
            <UserPlus className="h-3.5 w-3.5" /> Add Walk-in
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── QR code dialog — attendees scan this to self-register ─── */
function ScanDialog({
  open, onClose, eventId, eventName,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
}) {
  const [origin, setOrigin] = useState("");
  const [QRCodeSVG, setQRCodeSVG] = useState<ComponentType<{
    id?: string; value: string; size?: number; bgColor?: string;
    fgColor?: string; level?: string; includeMargin?: boolean;
  }> | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrigin(window.location.origin);
    import("qrcode.react").then((m) => setQRCodeSVG(() => m.QRCodeSVG));
  }, [open]);

  const registrationUrl = `${origin}/checkin/${eventId}`;

  const downloadQr = () => {
    const svg = document.getElementById("event-qr-svg");
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventName.replace(/\s+/g, "-")}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-danger" /> Attendee Self-Registration QR
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* QR code */}
          <div className="rounded-2xl border-4 border-danger bg-white p-4 shadow-sm">
            {QRCodeSVG && origin ? (
              <QRCodeSVG
                id="event-qr-svg"
                value={registrationUrl}
                size={220}
                bgColor="#ffffff"
                fgColor="#B91C1C"
                level="M"
                includeMargin={false}
              />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center text-[11px] text-text-3">
                Generating…
              </div>
            )}
          </div>

          <div className="w-full space-y-1 text-center">
            <p className="text-[13px] font-bold text-text-1">{eventName}</p>
            <p className="text-[11px] text-text-3">
              Attendees scan this with their phone camera to self-register for the event.
            </p>
            <p className="mt-1 break-all rounded-md bg-bg-2 px-2 py-1 font-mono text-[10px] text-text-4">
              {registrationUrl}
            </p>
          </div>

          <button onClick={downloadQr} className={btnCls("ghost", "w-full justify-center")}>
            <Download className="h-3.5 w-3.5" /> Download QR (SVG)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
