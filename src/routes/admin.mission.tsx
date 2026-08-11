import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { titleCase } from "@/lib/utils";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Topbar } from "@/components/admin/layout/topbar";
import { Card, CardBody, Kpi, Pill } from "@/components/admin/composables/ui-bits";
import {
  ColumnFilter,
  ColumnHeader,
  applyColumnFilter,
  type ColumnFilterValue,
} from "@/components/admin/composables/tables/table-filters";
import { YouthSearchInput, type PickedYouth } from "@/components/admin/composables/pickers/youth-search-input";
import { fetchOrg, type OrgTree } from "@/lib/db/org";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePagination, TablePagination } from "@/components/admin/composables/tables/table-pagination";
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
import { MoreVertical, Trash2, Upload, Download, Plus, Shuffle, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  generatePairings,
  getMissionAnalytics,
  getOrCreateMissionWeek,
  listMissionNominees,
  listMissionPairings,
  nominateYouth,
  removeNominee,
} from "@/lib/db/activities/mission";

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => CURRENT_YEAR - i);

const missionSearchSchema = z.object({
  year: fallback(z.number(), CURRENT_YEAR).default(CURRENT_YEAR),
});

export const Route = createFileRoute("/admin/mission")({
  head: () => ({
    meta: [
      { title: "Mission Week — CDM Youth Office" },
      { name: "description", content: "Annual cross-parish youth reshuffle: nominations, automated pairing, and execution tracking." },
    ],
  }),
  validateSearch: zodValidator(missionSearchSchema),
  component: MissionPage,
});

function MissionPage() {
  const qc = useQueryClient();
  const { year } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setYear = (y: number) =>
    navigate({ search: () => ({ year: y }), replace: true });
  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const { data: week } = useQuery({ queryKey: ["mission-week", year], queryFn: () => getOrCreateMissionWeek(year) });
  const weekId = week?.id;
  const { data: nominees = [] } = useQuery({
    queryKey: ["mission-nominees", weekId],
    queryFn: () => listMissionNominees(weekId!),
    enabled: !!weekId,
  });
  const { data: pairings = [] } = useQuery({
    queryKey: ["mission-pairings", weekId],
    queryFn: () => listMissionPairings(weekId!),
    enabled: !!weekId,
  });
  const { data: analytics } = useQuery({
    queryKey: ["mission-analytics", weekId],
    queryFn: () => getMissionAnalytics(weekId!),
    enabled: !!weekId,
  });
  const invalidate = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ["mission-nominees", weekId] }),
      qc.refetchQueries({ queryKey: ["mission-pairings", weekId] }),
      qc.refetchQueries({ queryKey: ["mission-analytics", weekId] }),
    ]);
  };
  const [nominateOpen, setNominateOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [reshuffleOpen, setReshuffleOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [fName, setFName] = useState<ColumnFilterValue | undefined>();
  const [fSourceParish, setFSourceParish] = useState<ColumnFilterValue | undefined>();
  const [fSourceDeanery, setFSourceDeanery] = useState<ColumnFilterValue | undefined>();
  const [fHostParish, setFHostParish] = useState<ColumnFilterValue | undefined>();
  const [fStatus, setFStatus] = useState<ColumnFilterValue | undefined>();
  const nominateMut = useMutation({
    mutationFn: (cdmId: string) => nominateYouth(weekId!, cdmId),
    onSuccess: () => { toast.success("Nominee added"); setNominateOpen(false); invalidate(); },
    onError: (e: Error) => { toast.error(e.message); },
  });
  const removeMut = useMutation({
    mutationFn: removeNominee,
    onSuccess: () => { toast.success("Nominee removed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reshuffleMut = useMutation({
    mutationFn: () => generatePairings(weekId!),
    onSuccess: (n) => { toast.success(`Generated ${n} pairings`); setReshuffleOpen(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const importMut = useMutation({
    mutationFn: async (cdmIds: string[]) => {
      let ok = 0;
      const errors: string[] = [];
      for (const cdm of cdmIds) {
        try { await nominateYouth(weekId!, cdm); ok++; } catch (e) { errors.push(`${cdm}: ${(e as Error).message}`); }
      }
      return { ok, errors };
    },
    onSuccess: ({ ok, errors }) => {
      if (ok) toast.success(`Imported ${ok} nominee${ok === 1 ? "" : "s"}`);
      if (errors.length) toast.error(`${errors.length} failed: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "…" : ""}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

const pairingByYouth = useMemo(() => {
    const m = new Map<string, (typeof pairings)[number]>();
    pairings.forEach((p) => m.set(p.youth_id, p));
    return m;
  }, [pairings]);

  const rows = nominees.map((n) => {
    const pair = pairingByYouth.get(n.youth_id);
    return {
      id: n.id,
      name: n.youth?.full_name ?? "—",
      cdmId: n.youth?.cdm_id ?? "—",
      sourceParish: n.youth?.parish?.name ?? "—",
      sourceDeanery: n.youth?.parish?.deanery?.name ?? "—",
      hostParish: pair?.host_parish?.name ?? "—",
      hostDeanery: pair?.host_parish?.deanery?.name ?? "—",
      status: pair?.status ?? n.status,
      paired: !!pair,
    };
  });

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(q) &&
          !r.cdmId.toLowerCase().includes(q) &&
          !r.sourceParish.toLowerCase().includes(q) &&
          !r.hostParish.toLowerCase().includes(q)
        ) return false;
      }
      if (!applyColumnFilter(r.name, fName)) return false;
      if (!applyColumnFilter(r.sourceParish, fSourceParish)) return false;
      if (!applyColumnFilter(r.sourceDeanery, fSourceDeanery)) return false;
      if (!applyColumnFilter(r.hostParish, fHostParish)) return false;
      if (!applyColumnFilter(r.status, fStatus)) return false;
      return true;
    });
  }, [rows, search, fName, fSourceParish, fSourceDeanery, fHostParish, fStatus]);

  const rowPagination = usePagination(filteredRows, 10);

  const handleExport = () => {
    const headers = ["CDM No.", "Name", "Source Parish", "Source Deanery", "Sent To Parish", "Sent To Deanery", "Status"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers.join(",")]
      .concat(rows.map((r) => [r.cdmId, r.name, r.sourceParish, r.sourceDeanery, r.hostParish, r.hostDeanery, r.status].map(escape).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mission-week-${week?.year ?? year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export started");
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { toast.error("Empty file"); return; }
    const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const cdmIdx = header.findIndex((h) => /cdm/.test(h));
    if (cdmIdx === -1) { toast.error("CSV must include a 'CDM No.' column"); return; }
    const cdmIds = lines.slice(1).map((l) => (l.split(",")[cdmIdx] ?? "").trim().replace(/^"|"$/g, "")).filter(Boolean);
    if (!cdmIds.length) { toast.error("No CDM numbers found"); return; }
    importMut.mutate(cdmIds);
  };

  return (
    <>
      <Topbar
        title={`Mission Week ${week?.year ?? year}`}
        description={week?.theme ?? "Annual cross-parish youth exchange. Add nominees, then run the reshuffle to auto-pair them with host parishes."}
        action={
          <>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Select mission week year"
              className="h-8 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 outline-none transition hover:border-gold-3 focus:border-gold-3"
            >
              {AVAILABLE_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!weekId || nominees.length === 0) {
                  toast.error("Add nominees before running the reshuffle");
                  return;
                }
                setReshuffleOpen(true);
              }}
              disabled={reshuffleMut.isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <Shuffle className="h-3.5 w-3.5" /> {reshuffleMut.isPending ? "Reshuffling…" : "Run Reshuffle"}
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Nominees" value={String(analytics?.nominees ?? 0)} trend={`${nominees.length} loaded`} tone="up" />
          <Kpi label="Parishes" value={String(analytics?.parishes ?? 0)} trend="diocese-wide" tone="up" />
          <Kpi label="Reshuffle Pairs" value={String(analytics?.pairs ?? 0)} trend={pairings.length ? "generated" : "run reshuffle"} tone="info" />
          <Kpi label="Reports In" value={String(analytics?.reports ?? 0)} trend={`of ${pairings.length} pairs`} tone="warn" />
        </div>

        <Card>
          {/* Toolbar — search + action buttons */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3.5 py-2.5">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, CDM No., parish…"
                className="h-8 w-full rounded-md border border-black/20 bg-white pl-8 pr-7 text-[12px] text-black/70 placeholder:text-gray-400 placeholder:font-normal outline-none transition-colors hover:border-gold-3/50 hover:text-black focus:border-gold-3 focus:text-black"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-3 hover:bg-bg-3 hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = "";
              }}
            />
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setNominateOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-2.5 text-[11px] font-bold text-white transition hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> Nominate
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-2.5 text-[11px] font-bold text-white transition hover:opacity-90"
              >
                <Upload className="h-3.5 w-3.5" /> Import
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-2.5 text-[11px] font-bold text-white transition hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </div>
          </div>

          <CardBody className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">CDM No.</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Name" filter={<ColumnFilter label="Name" value={fName} onChange={setFName} />} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Source Parish" filter={<ColumnFilter label="Source Parish" value={fSourceParish} onChange={setFSourceParish} />} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Source Deanery" filter={<ColumnFilter label="Source Deanery" value={fSourceDeanery} onChange={setFSourceDeanery} />} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Sent To Parish" filter={<ColumnFilter label="Sent To Parish" value={fHostParish} onChange={setFHostParish} />} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Sent To Deanery</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Status" filter={<ColumnFilter label="Status" value={fStatus} onChange={setFStatus} />} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rowPagination.pageRows.map((r) => (
                  <tr key={r.id} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                    <td className="px-3.5 py-2.5 font-mono text-[10px] font-bold text-gold">{r.cdmId}</td>
                    <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">{titleCase(r.name)}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{r.sourceParish}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">{r.sourceDeanery}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{r.hostParish}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">{r.hostDeanery}</td>
                    <td className="px-3.5 py-2.5">
                      <Pill tone={r.paired ? "info" : "neutral"}>{r.status}</Pill>
                    </td>
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
                          <DropdownMenuItem
                            className="text-danger focus:text-danger"
                            onClick={() => setRemoveTarget({ id: r.id, name: r.name })}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove nominee
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3.5 py-6 text-center text-[11px] text-text-3">
                      {rows.length === 0
                        ? `No nominees yet. Click "Nominate" to add a missionary by CDM No.`
                        : "No results match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardBody>
          {rows.length > 0 && (
            <TablePagination
              page={rowPagination.page}
              pageSize={rowPagination.pageSize}
              total={rowPagination.total}
              totalPages={rowPagination.totalPages}
              onPageChange={rowPagination.setPage}
              onPageSizeChange={rowPagination.setPageSize}
            />
          )}
        </Card>
      </div>
      <NominateDialog
        open={nominateOpen}
        onOpenChange={setNominateOpen}
        org={org}
        isPending={nominateMut.isPending}
        onSubmit={(cdmId) => nominateMut.mutate(cdmId)}
      />
      <AlertDialog open={removeTarget !== null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove nominee?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeTarget?.name}</strong> will be removed from Mission Week. Their pairing (if any) is also cleared.
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
      <AlertDialog open={reshuffleOpen} onOpenChange={setReshuffleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run reshuffle?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears any existing pairings for Mission Week {week?.year ?? year} and randomly assigns each of the {nominees.length} nominee{nominees.length === 1 ? "" : "s"} to a host parish outside their own. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reshuffleMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reshuffleMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                reshuffleMut.mutate();
              }}
            >
              {reshuffleMut.isPending ? "Reshuffling…" : "Yes, run reshuffle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Nominate dialog                                                     */
/* ------------------------------------------------------------------ */

function NominateDialog({
  open,
  onOpenChange,
  org,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  org?: OrgTree;
  isPending: boolean;
  onSubmit: (cdmId: string) => void;
}) {
  const [youth, setYouth] = useState<PickedYouth | null>(null);

  useEffect(() => {
    if (open) setYouth(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            Nominate Missionary
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            Find by CDM No. or browse by location. Name, phone, parish and deanery are filled automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-3">Youth *</p>
          <YouthSearchInput value={youth} onChange={setYouth} org={org} />
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
            onClick={() => {
              if (!youth) { toast.error("Select a youth first"); return; }
              onSubmit(youth.cdm_id);
            }}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Add Nominee"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Script — constants & config                                         */
/* ------------------------------------------------------------------ */
