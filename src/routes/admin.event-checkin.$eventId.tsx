import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, QrCode, Search, UserPlus, X, BadgeCheck, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/admin/layout/topbar";
import { Kpi } from "@/components/admin/composables/ui-bits";
import { usePagination, TablePagination } from "@/components/admin/composables/tables/table-pagination";
import { getEventFull, registerForEvent, deleteRegistration } from "@/lib/db/activities/events";
import { listYouthsPaged, fetchYouthByCdmId, type YouthRow } from "@/lib/db/youth-records/youths";
import { fetchOrg, type OrgTree } from "@/lib/db/org";
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
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event-full", eventId],
    queryFn: () => getEventFull(eventId),
  });

  // Org tree: loaded once, cached for the session — no re-fetching needed.
  const { data: org } = useQuery({
    queryKey: ["org"],
    queryFn: fetchOrg,
    staleTime: Infinity,
  });

  const registerMut = useMutation({
    mutationFn: registerForEvent,
    onSuccess: (_data, variables) => {
      toast.success(`${variables.guestName ?? variables.cdmId ?? "Attendee"} registered`);
      qc.invalidateQueries({ queryKey: ["event-full", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: deleteRegistration,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-full", eventId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [attendees, setAttendees] = useState<AttendeeEntry[]>([]);

  useEffect(() => {
    if (!event) return;
    setAttendees(
      event.registrations.map((reg) => ({
        id: reg.id,
        cdmId: reg.youth?.cdm_id ?? "—",
        name: reg.youth?.full_name ?? reg.guest_name ?? "—",
        phone: reg.youth?.phone ?? "",
        deanery: reg.youth?.deanery?.name ?? "",
        parish: reg.youth?.parish?.name ?? "",
        outstation: reg.youth?.outstation?.name ?? "",
        time: new Date(reg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        kind: reg.youth ? "member" : "guest",
      })),
    );
  }, [event]);

  /* ── page-level filters (filter the already-loaded attendee list) ── */
  const [deaneryId, setDeaneryId] = useState("");
  const [parishId, setParishId] = useState("");
  const [outstationId, setOutstationId] = useState("");
  const [q, setQ] = useState("");

  /* dialog state */
  const [registerOpen, setRegisterOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  /* cascading filter options from real org data — pure JS, zero DB calls */
  const parishOptions = useMemo(() => {
    if (!org) return [];
    return deaneryId ? org.parishes.filter((p) => p.deanery_id === deaneryId) : org.parishes;
  }, [org, deaneryId]);

  const outstationOptions = useMemo(() => {
    if (!org) return [];
    if (parishId) return org.outstations.filter((o) => o.parish_id === parishId);
    if (deaneryId) return org.outstations.filter((o) => parishOptions.some((p) => p.id === o.parish_id));
    return org.outstations;
  }, [org, deaneryId, parishId, parishOptions]);

  /* resolve selected IDs → names for attendee filtering */
  const selectedDeaneryName = org?.deaneries.find((d) => d.id === deaneryId)?.name ?? "";
  const selectedParishName = org?.parishes.find((p) => p.id === parishId)?.name ?? "";
  const selectedOutstationName = org?.outstations.find((o) => o.id === outstationId)?.name ?? "";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return attendees.filter((a) => {
      if (deaneryId && a.deanery !== selectedDeaneryName) return false;
      if (parishId && a.parish !== selectedParishName) return false;
      if (outstationId && a.outstation !== selectedOutstationName) return false;
      if (term && ![a.name, a.cdmId, a.phone, a.parish, a.outstation].join(" ").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [attendees, deaneryId, parishId, outstationId, selectedDeaneryName, selectedParishName, selectedOutstationName, q]);

  const pagination = usePagination(filtered, 25);

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
  const filteredMemberCount = filtered.filter((a) => a.kind === "member").length;
  const filteredGuestCount = filtered.filter((a) => a.kind === "guest").length;
  const hasFilter = !!(deaneryId || parishId || outstationId || q);

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
        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 gap-2.5 border-b border-border px-4 py-3 sm:grid-cols-4">
          <Kpi
            label="Registrations"
            value={String(filtered.length)}
            trend={hasFilter ? "after filters" : "total registered"}
            tone="info"
          />
          <Kpi
            label="Members"
            value={String(filteredMemberCount)}
            trend={hasFilter ? `of ${memberCount} total` : "CDM youth"}
            tone="up"
          />
          <Kpi
            label="Guests"
            value={String(filteredGuestCount)}
            trend={hasFilter ? `of ${guestCount} total` : "walk-in / external"}
            tone="warn"
          />
          <Kpi
            label="Check-ins"
            value={String(event.checkin_count)}
            trend="confirmed on day"
            tone="up"
          />
        </div>

        {/* ── filter + action bar ── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-2 px-4 py-2.5">
          <select
            value={deaneryId}
            onChange={(e) => { setDeaneryId(e.target.value); setParishId(""); setOutstationId(""); }}
            className={selectCls("max-w-[160px]")}
          >
            <option value="">All Deaneries</option>
            {(org?.deaneries ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={parishId}
            onChange={(e) => { setParishId(e.target.value); setOutstationId(""); }}
            className={selectCls("max-w-[160px]")}
            disabled={parishOptions.length === 0}
          >
            <option value="">All Parishes</option>
            {parishOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={outstationId}
            onChange={(e) => setOutstationId(e.target.value)}
            className={selectCls("max-w-[160px]")}
            disabled={outstationOptions.length === 0}
          >
            <option value="">All Outstations</option>
            {outstationOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
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

          {hasFilter && (
            <button
              onClick={() => { setDeaneryId(""); setParishId(""); setOutstationId(""); setQ(""); }}
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
              {pagination.pageRows.map((a) => (
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
                      onClick={() => removeMut.mutate(a.id)}
                      disabled={removeMut.isPending}
                      className="rounded p-0.5 text-text-4 hover:bg-danger-soft hover:text-danger disabled:opacity-50"
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
        {filtered.length > 0 && (
          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        )}
      </div>

      {/* ── dialogs ── */}
      {org && (
        <RegisterDialog
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          org={org}
          defaultDeaneryId={deaneryId}
          defaultParishId={parishId}
          defaultOutstationId={outstationId}
          onAdd={(cdmId) => registerMut.mutate({ eventId, cdmId })}
        />
      )}
      <WalkInDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        onAdd={(input) => registerMut.mutate({ eventId, ...input })}
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
  open, onClose, org, defaultDeaneryId, defaultParishId, defaultOutstationId, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  org: OrgTree;
  defaultDeaneryId: string;
  defaultParishId: string;
  defaultOutstationId: string;
  onAdd: (cdmId: string) => void;
}) {
  const [mode, setMode] = useState<"cdm" | "browse">("cdm");

  /* ── CDM mode ── */
  const [cdmInput, setCdmInput] = useState("");
  const [lookupKey, setLookupKey] = useState(""); // set on button click to trigger query

  const { data: preview, isFetching: lookingUp } = useQuery({
    queryKey: ["youth-by-cdm", lookupKey],
    queryFn: () => fetchYouthByCdmId(lookupKey),
    enabled: !!lookupKey,
    staleTime: 60_000,
    retry: false,
  });

  const cdmError = lookupKey && !lookingUp && preview === null
    ? `No youth found with CDM No. "${lookupKey}"`
    : "";

  /* ── Browse mode ── */
  const [bDeaneryId, setBDeaneryId] = useState(defaultDeaneryId);
  const [bParishId, setBParishId] = useState(defaultParishId);
  const [bOutstationId, setBOutstationId] = useState(defaultOutstationId);
  const [bSearch, setBSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Seed from page-level filters when dialog opens
  useEffect(() => {
    if (open) {
      setBDeaneryId(defaultDeaneryId);
      setBParishId(defaultParishId);
      setBOutstationId(defaultOutstationId);
    }
  }, [open, defaultDeaneryId, defaultParishId, defaultOutstationId]);

  // Debounce the search input (250 ms) to avoid a query per keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(bSearch), 250);
    return () => clearTimeout(t);
  }, [bSearch]);

  /* Cascade options — pure JS from the cached org tree, zero DB calls */
  const browseParishes = bDeaneryId
    ? org.parishes.filter((p) => p.deanery_id === bDeaneryId)
    : org.parishes;

  const browseOutstations = bParishId
    ? org.outstations.filter((o) => o.parish_id === bParishId)
    : bDeaneryId
      ? org.outstations.filter((o) => browseParishes.some((p) => p.id === o.parish_id))
      : org.outstations;

  /* Youth search — one debounced query combining name + all org filters */
  const { data: browseData, isFetching: searching } = useQuery({
    queryKey: ["youth-search", debouncedSearch, bDeaneryId, bParishId, bOutstationId],
    queryFn: () =>
      listYouthsPaged({
        q: debouncedSearch,
        deaneryId: bDeaneryId || null,
        parishId: bParishId || null,
        outstationId: bOutstationId || null,
        size: 50,
      }),
    enabled: debouncedSearch.trim().length >= 1,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const browseResults: YouthRow[] = browseData?.data ?? [];

  const reset = () => {
    setCdmInput("");
    setLookupKey("");
    setBSearch("");
    setDebouncedSearch("");
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

        {/* ── CDM mode ── */}
        {mode === "cdm" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={cdmInput}
                onChange={(e) => { setCdmInput(e.target.value); setLookupKey(""); }}
                onKeyDown={(e) => e.key === "Enter" && setLookupKey(cdmInput.trim().toUpperCase())}
                placeholder="CDM-2026-00001"
                className="flex-1"
              />
              <button
                onClick={() => setLookupKey(cdmInput.trim().toUpperCase())}
                disabled={!cdmInput.trim() || lookingUp}
                className={btnCls("primary")}
              >
                {lookingUp
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Search className="h-3.5 w-3.5" />}
                Look up
              </button>
            </div>
            {cdmError && <p className="text-[11px] text-danger">{cdmError}</p>}
            {preview && (
              <div className="rounded-lg border border-border bg-bg-2 p-3 space-y-1">
                <div className="font-bold text-[13px] text-text-1">{preview.full_name}</div>
                <div className="text-[11px] text-text-3">
                  {preview.cdm_id} · {preview.outstation?.name ?? preview.parish?.name ?? "—"} · {preview.category}
                </div>
                {preview.phone && <div className="text-[11px] text-text-3">{preview.phone}</div>}
                <button
                  onClick={() => { onAdd(preview.cdm_id); reset(); onClose(); }}
                  className={btnCls("primary", "mt-2")}
                >
                  <BadgeCheck className="h-3.5 w-3.5" /> Register
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Browse mode ── */}
        {mode === "browse" && (
          <div className="space-y-3">
            {/* Cascading location selects — no DB calls, cascade from cached org tree */}
            <div className="flex flex-wrap gap-2">
              <select
                value={bDeaneryId}
                onChange={(e) => { setBDeaneryId(e.target.value); setBParishId(""); setBOutstationId(""); }}
                className={selectCls("flex-1 min-w-[120px]")}
              >
                <option value="">All Deaneries</option>
                {org.deaneries.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <select
                value={bParishId}
                onChange={(e) => { setBParishId(e.target.value); setBOutstationId(""); }}
                className={selectCls("flex-1 min-w-[120px]")}
                disabled={browseParishes.length === 0}
              >
                <option value="">All Parishes</option>
                {browseParishes.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <select
                value={bOutstationId}
                onChange={(e) => setBOutstationId(e.target.value)}
                className={selectCls("flex-1 min-w-[120px]")}
                disabled={browseOutstations.length === 0}
              >
                <option value="">All Outstations</option>
                {browseOutstations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Name search — debounced, one call covers name + all org filters */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-4" />
              <Input
                value={bSearch}
                onChange={(e) => setBSearch(e.target.value)}
                placeholder="Search name or CDM No."
                className="pl-8 pr-8"
              />
              {searching && (
                <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-text-4" />
              )}
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {!debouncedSearch.trim() ? (
                <div className="p-4 text-center text-[11px] text-text-3">
                  Type a name or CDM No. above to search
                  {(bDeaneryId || bParishId || bOutstationId) && " within the selected location"}.
                </div>
              ) : browseResults.length === 0 && !searching ? (
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
                        {y.deanery?.name ? ` · ${y.deanery.name}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => { onAdd(y.cdm_id); }}
                      className={btnCls("primary", "shrink-0")}
                    >
                      Register
                    </button>
                  </div>
                ))
              )}
            </div>

            {debouncedSearch.trim() && browseResults.length > 0 && (
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
  onAdd: (input: { guestName: string; guestPhone?: string; notes?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");

  const reset = () => { setName(""); setPhone(""); setArea(""); };

  const submit = () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    onAdd({
      guestName: name.trim(),
      guestPhone: phone.trim() || undefined,
      notes: area.trim() ? `Area: ${area.trim()}` : undefined,
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
