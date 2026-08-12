import { createFileRoute, Link } from "@tanstack/react-router";
import { titleCase, formatPhone } from "@/lib/utils";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, QrCode, Search, UserPlus, X, BadgeCheck, Download, Loader2, UserCog, MoreVertical, Trash2, FileText, Sheet, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/admin/layout/topbar";
import { Card, CardBody, Kpi } from "@/components/admin/composables/ui-bits";
import { usePagination, TablePagination } from "@/components/admin/composables/tables/table-pagination";
import {
  ColumnFilter,
  ColumnHeader,
  FilterClear,
  FilterRow,
  FilterSelect,
  TableToolbar,
  applyColumnFilter,
  type ColumnFilterValue,
} from "@/components/admin/composables/tables/table-filters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { getEventFull, registerForEvent, deleteRegistration, updateGuestRegistration } from "@/lib/db/activities/events";
import { apiFetch } from "@/lib/api/fetch-api";
import { listYouthsPaged, fetchYouthByCdmId, type YouthRow } from "@/lib/db/youth-records/youths";
import { fetchOrg, type OrgTree } from "@/lib/db/org";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AddYouthDialog, type AddYouthResult } from "@/components/admin/youth/add-youth-dialog";

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
  role: string;
};

const GUEST_ROLES = ["guest", "facilitator", "accompaniment", "patronage"] as const;
type GuestRole = typeof GUEST_ROLES[number];

const ROLE_TONE: Record<GuestRole, string> = {
  guest:         "bg-warn-soft text-gold",
  facilitator:   "bg-info-soft text-info",
  accompaniment: "bg-success-soft text-success",
  patronage:     "bg-violet-50 text-violet-600",
};

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

  const LEADERSHIP_WORKSHOP_ID = "391508e3-b057-48ef-aad0-2992046a91ff";
  const isLeadershipWorkshop = eventId === LEADERSHIP_WORKSHOP_ID;

  const [sheetSyncing, setSheetSyncing] = useState(false);

  const syncToSheets = async () => {
    setSheetSyncing(true);
    try {
      const res = await apiFetch("/api/sheets/leadership");
      const body = await res.json() as { ok?: boolean; synced?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast.success(`Sheet synced — ${body.synced ?? 0} registration${body.synced !== 1 ? "s" : ""} written`);
    } catch (e: unknown) {
      toast.error(`Sheet sync failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setSheetSyncing(false);
    }
  };

  const registerMut = useMutation({
    mutationFn: registerForEvent,
    onSuccess: (_data, variables) => {
      toast.success(`${variables.guestName ?? variables.cdmId ?? "Attendee"} registered`);
      qc.invalidateQueries({ queryKey: ["event-full", eventId] });
      // Sync to Google Sheets for Leadership Workshop
      if (eventId === LEADERSHIP_WORKSHOP_ID) {
        apiFetch("/api/sheets/leadership", {
          method: "POST",
          body: JSON.stringify({
            eventId,
            cdmId: variables.cdmId ?? null,
            guestName: variables.guestName ?? null,
            guestPhone: variables.guestPhone ?? null,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
              toast.warning(`Registered but sheet sync failed: ${(body as { error?: string }).error ?? res.status}`);
            }
          })
          .catch((err) => toast.warning(`Registered but sheet sync failed: ${err.message}`));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: deleteRegistration,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-full", eventId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateGuestRegistration>[1] }) =>
      updateGuestRegistration(id, input),
    onSuccess: () => {
      toast.success("Guest details updated");
      qc.invalidateQueries({ queryKey: ["event-full", eventId] });
      setEditTarget(null);
    },
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
        phone: reg.youth?.phone ?? reg.guest_phone ?? "",
        deanery: reg.youth?.deanery?.name ?? reg.guest_deanery ?? "",
        parish: reg.youth?.parish?.name ?? reg.guest_parish ?? "",
        outstation: reg.youth?.outstation?.name ?? reg.guest_outstation ?? "",
        time: new Date(reg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        kind: reg.youth ? "member" : "guest",
        role: reg.guest_role ?? (reg.youth ? "" : "guest"),
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
  const [addYouthOpen, setAddYouthOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<AttendeeEntry | null>(null);

  /* per-column filters */
  const [fCdm, setFCdm] = useState<ColumnFilterValue | undefined>(undefined);
  const [fName, setFName] = useState<ColumnFilterValue | undefined>(undefined);

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
    return attendees
      .filter((a) => {
        if (deaneryId && a.deanery !== selectedDeaneryName) return false;
        if (parishId && a.parish !== selectedParishName) return false;
        if (outstationId && a.outstation !== selectedOutstationName) return false;
        if (term && ![a.name, a.cdmId, a.phone, a.parish, a.outstation].join(" ").toLowerCase().includes(term)) return false;
        if (!applyColumnFilter(a.cdmId, fCdm)) return false;
        if (!applyColumnFilter(a.name, fName)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.kind === b.kind) return 0;
        return a.kind === "guest" ? 1 : -1;
      });
  }, [attendees, deaneryId, parishId, outstationId, selectedDeaneryName, selectedParishName, selectedOutstationName, q, fCdm, fName]);

  const pagination = usePagination(filtered, 10);

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
  const hasFilter = !!(deaneryId || parishId || outstationId || q || fCdm?.value || fName?.value);

  const exportPdf = async (rows: typeof filtered) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    // Sort: members first (already sorted), then within each group sort by deanery → parish
    const sorted = [...rows].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "member" ? -1 : 1;
      const d = a.deanery.localeCompare(b.deanery);
      if (d !== 0) return d;
      return a.parish.localeCompare(b.parish);
    });

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(event.name, 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Registrations & Check-in · Exported ${dateStr} · ${sorted.length} attendee${sorted.length !== 1 ? "s" : ""}`, 14, 20);
    autoTable(doc, {
      startY: 26,
      theme: "grid",
      head: [["#", "CDM No.", "Name", "Role", "Phone", "Deanery", "Parish", "Outstation", "Registered At"]],
      body: sorted.map((a, i) => [
        i + 1,
        a.cdmId === "—" ? "" : a.cdmId,
        a.name,
        a.kind === "guest" ? (a.role || "guest") : "member",
        a.phone || "",
        a.deanery || "",
        a.parish || "",
        a.outstation || "",
        a.time,
      ]),
      styles: { fontSize: 8, cellPadding: 2, lineColor: [210, 210, 210], lineWidth: 0.15 },
      headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: "bold", lineColor: [185, 28, 28], lineWidth: 0.15 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 28 }, 2: { cellWidth: 40 }, 3: { cellWidth: 22 } },
    });
    doc.save(`${event.name.replace(/\s+/g, "-")}-registrations.pdf`);
    toast.success(`Exported ${sorted.length} registrations`);
  };

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

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* ── KPI cards ── */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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

        <Card>
          {/* ── org filter row ── */}
          <FilterRow>
            <FilterSelect
              label="All Deaneries"
              value={deaneryId}
              onChange={(v) => { setDeaneryId(v); setParishId(""); setOutstationId(""); }}
              options={(org?.deaneries ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
            <FilterSelect
              label="All Parishes"
              value={parishId}
              onChange={(v) => { setParishId(v); setOutstationId(""); }}
              options={parishOptions.map((p) => ({ value: p.id, label: p.name }))}
              disabled={parishOptions.length === 0}
            />
            <FilterSelect
              label="All Outstations"
              value={outstationId}
              onChange={(v) => setOutstationId(v)}
              options={outstationOptions.map((o) => ({ value: o.id, label: o.name }))}
              disabled={outstationOptions.length === 0}
            />
            <FilterClear
              onClick={() => {
                setDeaneryId(""); setParishId(""); setOutstationId(""); setQ("");
                setFCdm(undefined); setFName(undefined);
              }}
              visible={hasFilter}
            />
          </FilterRow>

          {/* ── search + action buttons ── */}
          <TableToolbar
            searchValue={q}
            onSearchChange={setQ}
            searchPlaceholder="Search name, CDM No., phone…"
            extra={
              <>
                <button onClick={() => setRegisterOpen(true)} className={btnCls("primary")}>
                  <BadgeCheck className="h-3.5 w-3.5" /> Register
                </button>
                <button onClick={() => setWalkInOpen(true)} className={btnCls("primary")}>
                  <UserPlus className="h-3.5 w-3.5" /> Walk-in
                </button>
                <button onClick={() => setAddYouthOpen(true)} className={btnCls("ghost")}>
                  <UserCog className="h-3.5 w-3.5" /> New Youth
                </button>
                <button onClick={() => exportPdf(filtered)} className={btnCls("ghost")} title="Export current view as PDF">
                  <FileText className="h-3.5 w-3.5" /> Export PDF
                </button>
                {isLeadershipWorkshop && (
                  <button
                    onClick={syncToSheets}
                    disabled={sheetSyncing}
                    className={btnCls("ghost")}
                    title="Sync all registrations to Google Sheet"
                  >
                    {sheetSyncing
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Sheet className="h-3.5 w-3.5" />}
                    {sheetSyncing ? "Syncing…" : "Sync to Sheets"}
                  </button>
                )}
                <button onClick={() => setScanOpen(true)} className={btnCls("ghost")}>
                  <QrCode className="h-3.5 w-3.5" /> Show QR
                </button>
              </>
            }
          />

          <CardBody className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="CDM No."
                      filter={<ColumnFilter label="CDM No." value={fCdm} onChange={setFCdm} />}
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Name"
                      filter={<ColumnFilter label="Name" value={fName} onChange={setFName} />}
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Phone</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Deanery</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Parish</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Outstation</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Time</th>
                  <th className="label-eyebrow px-3.5 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3.5 py-10 text-center text-[12px] text-text-3">
                      {attendees.length === 0
                        ? "No registrations yet — use Register, Walk-in, or Scan to add attendees."
                        : "No attendees match the current filters."}
                    </td>
                  </tr>
                )}
                {pagination.pageRows.map((a) => (
                  <tr key={a.id} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                    <td className="px-3.5 py-2.5 font-mono text-[10px] font-bold text-gold">{a.cdmId}</td>
                    <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                      {titleCase(a.name)}
                      {a.kind === "guest" && (
                        <span
                          className={`ml-1.5 rounded px-1 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                            ROLE_TONE[a.role as GuestRole] ?? ROLE_TONE.guest
                          }`}
                        >
                          {a.role || "guest"}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-3">{formatPhone(a.phone) || "—"}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">{a.deanery || "—"}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{a.parish || "—"}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">{a.outstation || "—"}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-4">{a.time}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Row actions"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-2 text-text-2 hover:border-gold-3 hover:text-gold"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {a.kind === "guest" && (
                            <DropdownMenuItem onClick={() => setEditTarget(a)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit guest
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-danger focus:text-danger"
                            onClick={() => setRemoveTarget({ id: a.id, name: a.name })}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          </CardBody>
        </Card>
      </div>

      {/* ── dialogs ── */}
      {org && (
        <>
          <RegisterDialog
            open={registerOpen}
            onClose={() => setRegisterOpen(false)}
            org={org}
            defaultDeaneryId={deaneryId}
            defaultParishId={parishId}
            defaultOutstationId={outstationId}
            onAdd={(cdmId) => registerMut.mutate({ eventId, cdmId })}
          />
          <AddYouthDialog
            open={addYouthOpen}
            onClose={() => setAddYouthOpen(false)}
            org={org}
            title="Add Youth & Register"
            onSuccess={(youth: AddYouthResult) => {
              setAddYouthOpen(false);
              registerMut.mutate({ eventId, cdmId: youth.cdm_id });
            }}
          />
        </>
      )}
      <WalkInDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        org={org}
        onAdd={(input) => registerMut.mutate({ eventId, ...input })}
      />
      <ScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        eventId={eventId}
        eventName={event.name}
      />

      <AlertDialog open={removeTarget !== null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from event?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>{removeTarget?.name}</strong> from this event's registration list.
              Their youth record and all other data remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) removeMut.mutate(removeTarget.id);
                setRemoveTarget(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditGuestDialog
        open={editTarget !== null}
        target={editTarget}
        org={org}
        onClose={() => setEditTarget(null)}
        onSave={(id, input) => editMut.mutate({ id, input })}
      />
    </>
  );
}

const SEL_CLS = "h-8 flex-1 min-w-[120px] rounded-md border border-border bg-bg-2 px-2 text-[11px] font-medium text-text-1 outline-none transition hover:border-gold-3 focus:border-gold-3 disabled:opacity-40";

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
                <div className="font-bold text-[13px] text-text-1">{titleCase(preview.full_name)}</div>
                <div className="text-[11px] text-text-3">
                  {preview.cdm_id} · {preview.outstation?.name ?? preview.parish?.name ?? "—"} · {preview.category}
                </div>
                {preview.phone && <div className="text-[11px] text-text-3">{formatPhone(preview.phone)}</div>}
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
                className={SEL_CLS}
              >
                <option value="">All Deaneries</option>
                {org.deaneries.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <select
                value={bParishId}
                onChange={(e) => { setBParishId(e.target.value); setBOutstationId(""); }}
                className={SEL_CLS}
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
                className={SEL_CLS}
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
                      <div className="text-[12px] font-semibold text-text-1">{titleCase(y.full_name)}</div>
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
  open, onClose, org, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  org: OrgTree | undefined;
  onAdd: (input: {
    guestName: string;
    guestPhone?: string;
    guestDeanery?: string;
    guestParish?: string;
    guestOutstation?: string;
    guestRole?: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deaneryId, setDeaneryId] = useState("");
  const [parishId, setParishId] = useState("");
  const [outstationId, setOutstationId] = useState("");
  const [role, setRole] = useState<string>("guest");

  const reset = () => {
    setName(""); setPhone("");
    setDeaneryId(""); setParishId(""); setOutstationId("");
    setRole("guest");
  };

  const parishOptions = deaneryId
    ? (org?.parishes ?? []).filter((p) => p.deanery_id === deaneryId)
    : (org?.parishes ?? []);

  const outstationOptions = parishId
    ? (org?.outstations ?? []).filter((o) => o.parish_id === parishId)
    : deaneryId
      ? (org?.outstations ?? []).filter((o) => parishOptions.some((p) => p.id === o.parish_id))
      : (org?.outstations ?? []);

  const submit = () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const deaneryName  = org?.deaneries.find((d) => d.id === deaneryId)?.name;
    const parishName   = org?.parishes.find((p) => p.id === parishId)?.name;
    const outstName    = org?.outstations.find((o) => o.id === outstationId)?.name;
    onAdd({
      guestName:      name.trim(),
      guestPhone:     phone.trim() || undefined,
      guestDeanery:   deaneryName  || undefined,
      guestParish:    parishName   || undefined,
      guestOutstation: outstName   || undefined,
      guestRole:      role || undefined,
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
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

          <div className="grid grid-cols-1 gap-2">
            <label className="text-[11px] font-bold text-text-3">Location (optional)</label>
            <select
              value={deaneryId}
              onChange={(e) => { setDeaneryId(e.target.value); setParishId(""); setOutstationId(""); }}
              className={SEL_CLS}
            >
              <option value="">Select Deanery</option>
              {(org?.deaneries ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select
              value={parishId}
              onChange={(e) => { setParishId(e.target.value); setOutstationId(""); }}
              disabled={!deaneryId || parishOptions.length === 0}
              className={SEL_CLS}
            >
              <option value="">Select Parish</option>
              {parishOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={outstationId}
              onChange={(e) => setOutstationId(e.target.value)}
              disabled={!parishId || outstationOptions.length === 0}
              className={SEL_CLS}
            >
              <option value="">Select Outstation</option>
              {outstationOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-text-3">Role</label>
            <div className="flex flex-wrap gap-2">
              {GUEST_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-md border px-3 py-1.5 text-[11px] font-bold capitalize transition ${
                    role === r
                      ? "border-danger bg-danger text-white"
                      : "border-border bg-bg-2 text-text-2 hover:border-danger/50 hover:text-text-1"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
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
    import("qrcode.react").then((m) => setQRCodeSVG(m.QRCodeSVG as ComponentType<{
      id?: string; value: string; size?: number; bgColor?: string;
      fgColor?: string; level?: string; includeMargin?: boolean;
    }>));
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

/* ─── Edit guest dialog ─── */
function EditGuestDialog({
  open, target, org, onClose, onSave,
}: {
  open: boolean;
  target: AttendeeEntry | null;
  org: OrgTree | undefined;
  onClose: () => void;
  onSave: (id: string, input: Parameters<typeof updateGuestRegistration>[1]) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deaneryId, setDeaneryId] = useState("");
  const [parishId, setParishId] = useState("");
  const [outstationId, setOutstationId] = useState("");
  const [role, setRole] = useState<string>("guest");

  // Re-seed whenever the target changes (dialog opens for a different guest)
  useEffect(() => {
    if (!target || !org) return;
    setName(target.name);
    setPhone(target.phone);
    setRole(target.role || "guest");
    setDeaneryId(org.deaneries.find((d) => d.name === target.deanery)?.id ?? "");
    setParishId(org.parishes.find((p) => p.name === target.parish)?.id ?? "");
    setOutstationId(org.outstations.find((o) => o.name === target.outstation)?.id ?? "");
  }, [target, org]);

  const parishOptions = deaneryId
    ? (org?.parishes ?? []).filter((p) => p.deanery_id === deaneryId)
    : (org?.parishes ?? []);

  const outstationOptions = parishId
    ? (org?.outstations ?? []).filter((o) => o.parish_id === parishId)
    : deaneryId
      ? (org?.outstations ?? []).filter((o) => parishOptions.some((p) => p.id === o.parish_id))
      : (org?.outstations ?? []);

  const submit = () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!target) return;
    onSave(target.id, {
      guestName:        name.trim(),
      guestPhone:       phone.trim() || null,
      guestDeanery:     org?.deaneries.find((d) => d.id === deaneryId)?.name   ?? null,
      guestParish:      org?.parishes.find((p)  => p.id === parishId)?.name    ?? null,
      guestOutstation:  org?.outstations.find((o) => o.id === outstationId)?.name ?? null,
      guestRole:        role || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Guest Details</DialogTitle>
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

          <div className="grid grid-cols-1 gap-2">
            <label className="text-[11px] font-bold text-text-3">Location (optional)</label>
            <select
              value={deaneryId}
              onChange={(e) => { setDeaneryId(e.target.value); setParishId(""); setOutstationId(""); }}
              className={SEL_CLS}
            >
              <option value="">Select Deanery</option>
              {(org?.deaneries ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select
              value={parishId}
              onChange={(e) => { setParishId(e.target.value); setOutstationId(""); }}
              disabled={!deaneryId || parishOptions.length === 0}
              className={SEL_CLS}
            >
              <option value="">Select Parish</option>
              {parishOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={outstationId}
              onChange={(e) => setOutstationId(e.target.value)}
              disabled={!parishId || outstationOptions.length === 0}
              className={SEL_CLS}
            >
              <option value="">Select Outstation</option>
              {outstationOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-text-3">Role</label>
            <div className="flex flex-wrap gap-2">
              {GUEST_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-md border px-3 py-1.5 text-[11px] font-bold capitalize transition ${
                    role === r
                      ? "border-danger bg-danger text-white"
                      : "border-border bg-bg-2 text-text-2 hover:border-danger/50 hover:text-text-1"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button onClick={submit} className={btnCls("primary", "w-full justify-center")}>
            Save changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
