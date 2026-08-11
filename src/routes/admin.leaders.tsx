import { useEffect, useMemo, useRef, useState } from "react";
import { titleCase, formatPhone } from "@/lib/utils";
import Papa from "papaparse";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, MoreVertical, Plus, Upload } from "lucide-react";
import { type PagedResponse } from "@/lib/api/fetch-api";
import { YouthSearchInput, type PickedYouth } from "@/components/admin/composables/pickers/youth-search-input";
import { Topbar, TopbarButton, TopbarTab } from "@/components/admin/layout/topbar";
import { Card, CardBody } from "@/components/admin/composables/ui-bits";
import { TablePagination } from "@/components/admin/composables/tables/table-pagination";
import {
  ColumnFilter,
  ColumnHeader,
  TableToolbar,
  applyColumnFilter,
  type ColumnFilterValue,
} from "@/components/admin/composables/tables/table-filters";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchOrg, type OrgTree } from "@/lib/db/org";
import { useAdminScope } from "@/lib/hooks/use-admin-scope";
import {
  appointLeader,
  bulkImportLeaders,
  createRoleType,
  deleteLeader,
  endLeaderTerm,
  listLeadersPaged,
  listRoleTypes,
  updateLeader,
  type BulkLeaderRow,
  type LeadershipLevel,
  type LeadershipRoleInput,
  type LeadershipRoleRow,
  type LeadershipRoleUpdate,
  type RoleTypeRow,
} from "@/lib/db/youth-records/leaders";
import { AddYouthDialog, type AddYouthResult } from "@/components/admin/youth/add-youth-dialog";

const leadersSearchSchema = z.object({
  q:             fallback(z.string(), "").default(""),
  deanery_id:    fallback(z.string(), "").default(""),
  parish_id:     fallback(z.string(), "").default(""),
  outstation_id: fallback(z.string(), "").default(""),
});
type LeadersSearch = z.infer<typeof leadersSearchSchema>;

export const Route = createFileRoute("/admin/leaders")({
  validateSearch: zodValidator(leadersSearchSchema),
  head: () => ({
    meta: [
      { title: "Youth Leaders — CDM Youth Office" },
      { name: "description", content: "Track and manage active youth leaders at all organizational levels." },
    ],
  }),
  component: LeadersPage,
});

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function LeadersPage() {
  const [tab, setTab]             = useState<LeadershipLevel>("diocese");
  const [addYouthOpen, setAddYouthOpen] = useState(false);
  const [appointOpen, setAppointOpen] = useState(false);
  const [importOpen, setImportOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<LeadershipRoleRow | null>(null);
  const [endTarget, setEndTarget]     = useState<LeadershipRoleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadershipRoleRow | null>(null);
  const qc = useQueryClient();

  const search  = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setFilter = (patch: Partial<LeadersSearch>) =>
    navigate({ search: (prev: LeadersSearch) => ({ ...prev, ...patch }), replace: true });

  const scope = useAdminScope();
  const deaneryId    = scope.deaneryId || search.deanery_id;
  const parishId     = scope.parishId  || search.parish_id;
  const outstationId = search.outstation_id;

  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const { data: roleTypes = [] } = useQuery({ queryKey: ["role-types"], queryFn: listRoleTypes });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data: resp, isLoading } = useQuery({
    queryKey: [
      "leadership-roles", tab,
      search.q, deaneryId, parishId, outstationId,
      page - 1, pageSize,
    ],
    queryFn: () =>
      listLeadersPaged({
        level:         tab,
        page:          page - 1,
        size:          pageSize,
        q:             search.q     || undefined,
        deaneryId:     deaneryId    || null,
        parishId:      parishId     || null,
        outstationId:  outstationId || null,
      }),
    placeholderData: keepPreviousData,
  });
  const roles = resp?.data ?? [];
  const total = resp?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["leadership-roles"] });
  };

  const appointMut = useMutation({
    mutationFn: appointLeader,
    onSuccess: () => { toast.success("Leader appointed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRoleTypeMut = useMutation({
    mutationFn: createRoleType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-types"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: LeadershipRoleUpdate }) =>
      updateLeader(id, input),
    onSuccess: () => { toast.success("Appointment updated"); invalidate(); setEditTarget(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const endMut = useMutation({
    mutationFn: endLeaderTerm,
    onSuccess: () => { toast.success("Term ended"); invalidate(); setEndTarget(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteLeader,
    onSuccess: () => { toast.success("Appointment deleted"); invalidate(); setDeleteTarget(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Topbar
        title="Youth Leaders"
        tabs={
          <>
            {LEVELS.map((lvl) => (
              <TopbarTab key={lvl} active={tab === lvl} onClick={() => { setTab(lvl); setPage(1); }}>
                {LEVEL_LABELS[lvl]}
              </TopbarTab>
            ))}
          </>
        }
        action={
          <>
            <button
              type="button"
              onClick={() => setAddYouthOpen(true)}
              className="inline-flex h-8 w-24 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Add Youth
            </button>
            <TopbarButton onClick={() => setImportOpen(true)}>Import CSV</TopbarButton>
            <TopbarButton onClick={() => setAppointOpen(true)}>+ Appoint</TopbarButton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          <LeadersTable
            key={tab}
            rows={roles}
            org={org}
            levelLabel={LEVEL_LABELS[tab]}
            isLoading={isLoading}
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            onEdit={setEditTarget}
            onEndTerm={setEndTarget}
            onDelete={setDeleteTarget}
            q={search.q}
            deaneryId={deaneryId}
            parishId={parishId}
            outstationId={outstationId}
            scopeDeaneryId={scope.deaneryId}
            scopeParishId={scope.parishId}
            onFilterChange={(patch) => { setFilter(patch); setPage(1); }}
          />
        </Card>
      </div>

      {org && (
        <AddYouthDialog
          open={addYouthOpen}
          onClose={() => setAddYouthOpen(false)}
          org={org}
          onSuccess={(_youth: AddYouthResult) => {
            setAddYouthOpen(false);
            invalidate();
            qc.invalidateQueries({ queryKey: ["youths"] });
          }}
        />
      )}

      <AppointDialog
        open={appointOpen}
        onOpenChange={setAppointOpen}
        defaultLevel={tab}
        org={org}
        roleTypes={roleTypes}
        isPending={appointMut.isPending}
        onCreateRoleType={createRoleTypeMut.mutateAsync}
        onSubmit={(input) => { appointMut.mutate(input); setAppointOpen(false); }}
      />

      <EditDialog
        row={editTarget}
        roleTypes={roleTypes}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        isPending={updateMut.isPending}
        onCreateRoleType={createRoleTypeMut.mutateAsync}
        onSubmit={(input) => editTarget && updateMut.mutate({ id: editTarget.id, input })}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onDone={invalidate}
      />

      <AlertDialog open={!!endTarget} onOpenChange={(o) => { if (!o) setEndTarget(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>End term for {endTarget?.youth?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Today will be recorded as the end of their{" "}
              <strong>{endTarget?.role_type?.name}</strong> role at{" "}
              {LEVEL_LABELS[endTarget?.level ?? "diocese"]} level. The appointment history is
              preserved — this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => endTarget && endMut.mutate(endTarget.id)}
            >
              End term
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <strong>{deleteTarget?.youth?.full_name}</strong>'s{" "}
              <strong>{deleteTarget?.role_type?.name}</strong> appointment. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Leaders table                                                       */
/* ------------------------------------------------------------------ */

function LeadersTable({
  rows,
  org,
  levelLabel,
  isLoading,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onEndTerm,
  onDelete,
  q,
  deaneryId,
  parishId,
  outstationId,
  scopeDeaneryId,
  scopeParishId,
  onFilterChange,
}: {
  rows: LeadershipRoleRow[];
  org?: OrgTree;
  levelLabel: string;
  isLoading: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onEdit: (row: LeadershipRoleRow) => void;
  onEndTerm: (row: LeadershipRoleRow) => void;
  onDelete: (row: LeadershipRoleRow) => void;
  q: string;
  deaneryId: string;
  parishId: string;
  outstationId: string;
  scopeDeaneryId: string | null;
  scopeParishId: string | null;
  onFilterChange: (patch: Partial<LeadersSearch>) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState("all");
  // Local input state for search box; debounces before hitting the server
  const [searchInput, setSearchInput] = useState(q);
  const [fCdm,  setFCdm]  = useState<ColumnFilterValue | undefined>();
  const [fName, setFName] = useState<ColumnFilterValue | undefined>();
  const [fRole, setFRole] = useState<ColumnFilterValue | undefined>();

  // Debounce search input → URL (server query)
  useEffect(() => {
    const t = setTimeout(() => { if (searchInput !== q) onFilterChange({ q: searchInput }); }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Build dropdown options from live org tree (UUID values for server-side filtering)
  const deaneryOptions = useMemo(
    () => (org?.deaneries ?? []).map((d) => ({ value: d.id, label: d.name })),
    [org?.deaneries],
  );
  const parishOptions = useMemo(
    () =>
      (org?.parishes ?? [])
        .filter((p) => !deaneryId || p.deanery_id === deaneryId)
        .map((p) => ({ value: p.id, label: p.name })),
    [org?.parishes, deaneryId],
  );
  const outstationOptions = useMemo(
    () =>
      (org?.outstations ?? [])
        .filter((o) => !parishId || o.parish_id === parishId)
        .map((o) => ({ value: o.id, label: o.name })),
    [org?.outstations, parishId],
  );
  const roleOptions = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => { if (r.role_type?.name) seen.add(r.role_type.name); });
    return Array.from(seen).sort().map((n) => ({ value: n, label: n }));
  }, [rows]);

  // Client-side filter only for period/history and column-level CDM/name/role refinement.
  // Deanery/parish/outstation/search are server-side (already applied by the query).
  const displayRows = useMemo(() => {
    let base = rows;
    if (filterPeriod !== "all") {
      const p = TERM_PERIODS.find((t) => t.value === filterPeriod);
      if (p) {
        base = rows.filter((r) => {
          const sy = parseInt(r.start_date.slice(0, 4), 10);
          const ey = r.end_date ? parseInt(r.end_date.slice(0, 4), 10) : 9999;
          return sy < p.end && ey >= p.start;
        });
      }
    } else if (!showHistory) {
      base = rows.filter((r) => !r.end_date);
    }
    return base.filter((r) => {
      if (!applyColumnFilter(r.youth?.cdm_id,        fCdm))  return false;
      if (!applyColumnFilter(r.youth?.full_name,      fName)) return false;
      if (!applyColumnFilter(r.role_type?.name ?? "", fRole)) return false;
      return true;
    });
  }, [rows, showHistory, filterPeriod, fCdm, fName, fRole]);

  const fc = (
    label: string,
    value: ColumnFilterValue | undefined,
    onChange: (v: ColumnFilterValue | undefined) => void,
    mode: "text" | "select" = "text",
    options?: { value: string; label: string }[],
  ) => (
    <ColumnFilter label={label} mode={mode} options={options} value={value} onChange={onChange} />
  );

  const showEndDate = showHistory || filterPeriod !== "all";

  return (
    <>
      <TableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={`Search ${levelLabel.toLowerCase()} leaders…`}
        extra={
          <div className="flex items-center gap-1.5">
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              aria-label="Select term period"
              className="h-8 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 outline-none transition hover:border-gold-3 focus:border-gold-3"
            >
              <option value="all">All periods</option>
              {TERM_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}{p.value === `${CURRENT_TERM_START}-${CURRENT_TERM_START + 3}` ? " (current)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowHistory((h) => !h)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition ${
                showHistory
                  ? "border-gold-3 bg-warn-soft text-gold"
                  : "border-border bg-bg-2 text-text-2 hover:border-gold-3 hover:text-gold"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              {showHistory ? "Active only" : "Show history"}
            </button>
          </div>
        }
      />

      <CardBody className="p-0">
        {isLoading ? (
          <div className="py-10 text-center text-[11px] text-text-3">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="label-eyebrow px-3.5 py-2.5 text-left">
                  <ColumnHeader label="CDM No." filter={fc("CDM No.", fCdm, setFCdm)} />
                </th>
                <th className="label-eyebrow px-3.5 py-2.5 text-left">
                  <ColumnHeader label="Name" filter={fc("Name", fName, setFName)} />
                </th>
                <th className="label-eyebrow px-3.5 py-2.5 text-left">Phone</th>
                <th className="label-eyebrow px-3.5 py-2.5 text-left">
                  <ColumnHeader
                    label="Deanery"
                    filter={
                      <ColumnFilter
                        label="Deanery"
                        mode="select"
                        options={deaneryOptions}
                        value={deaneryId ? { operator: "equals", value: deaneryId } : undefined}
                        onChange={(v) =>
                          onFilterChange({ deanery_id: v?.value ?? "", parish_id: "", outstation_id: "" })
                        }
                        disabled={!!scopeDeaneryId}
                      />
                    }
                  />
                </th>
                <th className="label-eyebrow px-3.5 py-2.5 text-left">
                  <ColumnHeader
                    label="Parish"
                    filter={
                      <ColumnFilter
                        label="Parish"
                        mode="select"
                        options={parishOptions}
                        value={parishId ? { operator: "equals", value: parishId } : undefined}
                        onChange={(v) =>
                          onFilterChange({ parish_id: v?.value ?? "", outstation_id: "" })
                        }
                        disabled={!!scopeParishId}
                      />
                    }
                  />
                </th>
                <th className="label-eyebrow px-3.5 py-2.5 text-left">
                  <ColumnHeader
                    label="Outstation"
                    filter={
                      <ColumnFilter
                        label="Outstation"
                        mode="select"
                        options={outstationOptions}
                        value={outstationId ? { operator: "equals", value: outstationId } : undefined}
                        onChange={(v) =>
                          onFilterChange({ outstation_id: v?.value ?? "" })
                        }
                      />
                    }
                  />
                </th>
                <th className="label-eyebrow px-3.5 py-2.5 text-left">
                  <ColumnHeader
                    label="Position"
                    filter={fc("Position", fRole, setFRole, "select", roleOptions)}
                  />
                </th>
                {showEndDate && (
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Term</th>
                )}
                <th className="label-eyebrow px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                  <td className="px-3.5 py-2.5 font-mono text-[10px] font-bold text-gold">
                    {row.youth?.cdm_id ?? "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                    {titleCase(row.youth?.full_name) || "—"}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-[10px] text-text-3">
                    {formatPhone(row.youth?.phone) || "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-[11px] text-text-2">
                    {row.youth?.deanery?.name ?? "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-[11px] text-text-1">
                    {row.youth?.parish?.name ?? "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-[11px] text-text-2">
                    {row.youth?.outstation?.name ?? "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row.role_type?.name ?? "—"}</td>
                  {showEndDate && (
                    <td className="px-3.5 py-2.5 text-[11px] text-text-3">
                      {row.start_date} — {row.end_date ?? "present"}
                    </td>
                  )}
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
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onSelect={() => onEdit(row)}>
                          Edit
                        </DropdownMenuItem>
                        {!row.end_date && (
                          <DropdownMenuItem
                            onSelect={() => onEndTerm(row)}
                            className="text-warn focus:text-warn"
                          >
                            End term
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={() => onDelete(row)}
                          className="text-danger focus:text-danger"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={showEndDate ? 9 : 8} className="px-3.5 py-10 text-center text-[11px] text-text-3">
                    No leaders match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </CardBody>

      {total > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizes={[5, 10, 25, 50, 100]}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Edit dialog                                                         */
/* ------------------------------------------------------------------ */

function EditDialog({
  row,
  roleTypes,
  onOpenChange,
  isPending,
  onCreateRoleType,
  onSubmit,
}: {
  row: LeadershipRoleRow | null;
  roleTypes: RoleTypeRow[];
  onOpenChange: (o: boolean) => void;
  isPending: boolean;
  onCreateRoleType: (name: string) => Promise<RoleTypeRow>;
  onSubmit: (input: LeadershipRoleUpdate) => void;
}) {
  const [roleId, setRoleId]         = useState("");
  const [roleCustom, setRoleCustom] = useState("");
  const [level, setLevel]           = useState<LeadershipLevel>("diocese");
  const [startDate, setStartDate]   = useState("");
  const [notes, setNotes]           = useState("");

  useEffect(() => {
    if (row) {
      setRoleId(row.role_id);
      setRoleCustom("");
      setLevel(row.level);
      setStartDate(row.start_date);
      setNotes(row.notes ?? "");
    }
  }, [row]);

  const handleSubmit = async () => {
    let effectiveRoleId = roleId;
    if (roleId === "__new__") {
      if (!roleCustom.trim()) { toast.error("Enter a position name"); return; }
      const created = await onCreateRoleType(roleCustom.trim());
      effectiveRoleId = created.id;
    }
    if (!effectiveRoleId) { toast.error("Select a position"); return; }
    onSubmit({ roleId: effectiveRoleId, level, startDate, notes: notes.trim() || null });
  };

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            Edit Appointment
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            {titleCase(row?.youth?.full_name)} · <span className="font-mono">{row?.youth?.cdm_id}</span>
            {row?.youth?.phone && (
              <> · <span className="font-mono">{formatPhone(row.youth.phone)}</span></>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Position *</span>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {roleTypes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                  <SelectItem value="__new__">New position…</SelectItem>
                </SelectContent>
              </Select>
            </label>

            {roleId === "__new__" && (
              <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
                <span>Position name *</span>
                <Input
                  value={roleCustom}
                  onChange={(e) => setRoleCustom(e.target.value)}
                  placeholder="e.g. Welfare Coordinator"
                  autoFocus
                />
              </label>
            )}

            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Level *</span>
              <Select value={level} onValueChange={(v) => setLevel(v as LeadershipLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Start Date</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
          </div>

          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Notes (optional)</span>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Elected at Annual General Meeting"
            />
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Appoint dialog                                                      */
/* ------------------------------------------------------------------ */

function AppointDialog({
  open,
  onOpenChange,
  defaultLevel,
  org,
  roleTypes,
  isPending,
  onCreateRoleType,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultLevel: LeadershipLevel;
  org?: OrgTree;
  roleTypes: RoleTypeRow[];
  isPending: boolean;
  onCreateRoleType: (name: string) => Promise<RoleTypeRow>;
  onSubmit: (input: LeadershipRoleInput) => void;
}) {
  const [youth, setYouth]         = useState<PickedYouth | null>(null);
  const [roleId, setRoleId]       = useState("");
  const [roleCustom, setRoleCustom] = useState("");
  const [level, setLevel]         = useState<LeadershipLevel>(defaultLevel);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]         = useState("");

  useEffect(() => {
    if (open) {
      setYouth(null);
      setRoleId(""); setRoleCustom("");
      setLevel(defaultLevel);
      setStartDate(new Date().toISOString().slice(0, 10));
      setNotes("");
    }
  }, [open, defaultLevel]);

  const handleSubmit = async () => {
    if (!youth) { toast.error("Select a youth first"); return; }
    let effectiveRoleId = roleId;
    if (roleId === "__new__") {
      if (!roleCustom.trim()) { toast.error("Enter a position name"); return; }
      const created = await onCreateRoleType(roleCustom.trim());
      effectiveRoleId = created.id;
    }
    if (!effectiveRoleId) { toast.error("Select a position"); return; }

    onSubmit({
      youthId:      youth.id,
      roleId:       effectiveRoleId,
      level,
      deaneryId:    youth.deanery_id,
      parishId:     youth.parish_id,
      outstationId: youth.outstation_id,
      startDate,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            Appoint Leader
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            Find by CDM No. or browse by location. Details are pulled from their youth record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-3">Youth *</p>
            <YouthSearchInput value={youth} onChange={setYouth} org={org} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Position *</span>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {roleTypes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                  <SelectItem value="__new__">New position…</SelectItem>
                </SelectContent>
              </Select>
            </label>

            {roleId === "__new__" && (
              <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
                <span>Position name *</span>
                <Input
                  value={roleCustom}
                  onChange={(e) => setRoleCustom(e.target.value)}
                  placeholder="e.g. Welfare Coordinator"
                  autoFocus
                />
              </label>
            )}

            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Level *</span>
              <Select value={level} onValueChange={(v) => setLevel(v as LeadershipLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Start Date</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
          </div>

          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Notes (optional)</span>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Elected at Annual General Meeting"
            />
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Appoint"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Import dialog                                                       */
/* ------------------------------------------------------------------ */

function ImportDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{
    inserted: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const handleClose = () => { setResult(null); onOpenChange(false); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data }) => {
        const rows: BulkLeaderRow[] = data.map((row) => ({
          cdmId:          (row["cdm_id"]      ?? row["CDM ID"]      ?? "").trim(),
          roleName:       (row["role"]        ?? row["Role"]        ?? "").trim(),
          level:          ((row["level"]      ?? row["Level"]       ?? "parish")
                            .toLowerCase().trim()) as LeadershipLevel,
          deaneryName:    (row["deanery"]     ?? row["Deanery"]     ?? "").trim(),
          parishName:     (row["parish"]      ?? row["Parish"]      ?? "").trim(),
          outstationName: (row["outstation"]  ?? row["Outstation"]  ?? "").trim(),
        }));
        try {
          const res = await bulkImportLeaders(rows);
          setResult(res);
          if (res.inserted > 0) onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Import failed");
        } finally {
          setLoading(false);
          e.target.value = "";
        }
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            Import Leaders (CSV)
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            CSV columns:{" "}
            <code className="rounded bg-bg-3 px-1 font-mono text-[10px]">
              cdm_id, role, level, deanery, parish, outstation
            </code>
            <br />
            Valid levels: <code className="font-mono">diocese / deanery / parish / outstation</code>.
            <br />
            Leaders must already exist as registered youths — unmatched CDM IDs are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-dashed border-border bg-bg-2 p-5 text-center">
            <Upload className="mx-auto mb-2 h-6 w-6 text-text-3" />
            <p className="mb-3 text-[11px] text-text-3">
              {loading ? "Processing…" : "Choose a CSV file to upload"}
            </p>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg-3 px-3 py-1.5 text-[11px] font-bold text-text-1 hover:bg-bg-4">
              {loading ? "Importing…" : "Choose file"}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFile}
                disabled={loading}
              />
            </label>
          </div>

          {result && (
            <div className="rounded-lg border border-border bg-bg-2 p-3 text-[11px]">
              <div className="mb-1.5 font-bold text-text-1">Import result</div>
              <div className="text-success">✓ Inserted: {result.inserted}</div>
              <div className="text-text-3">Skipped (duplicates / not found): {result.skipped}</div>
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-32 space-y-0.5 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-danger">{e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Script — constants & config                                         */
/* ------------------------------------------------------------------ */

const LEVELS: LeadershipLevel[] = ["diocese", "deanery", "parish", "outstation"];
const LEVEL_LABELS: Record<LeadershipLevel, string> = {
  diocese:    "Diocese",
  deanery:    "Deanery",
  parish:     "Parish",
  outstation: "Outstation",
};

const CURRENT_TERM_START = 2026;
const TERM_PERIODS = Array.from({ length: 7 }, (_, i) => {
  const start = CURRENT_TERM_START - i * 3;
  return { value: `${start}-${start + 3}`, label: `${start}–${start + 3}`, start, end: start + 3 };
});
