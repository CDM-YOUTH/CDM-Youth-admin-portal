import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { RecordFormDialog, type FieldDef } from "@/components/admin/record-form-dialog";
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
import { MoreVertical, Trash2, Upload, Download, Plus, Shuffle } from "lucide-react";
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
} from "@/lib/db/mission";

export const Route = createFileRoute("/admin/mission")({
  head: () => ({
    meta: [
      { title: "Mission Week — CDM Youth Office" },
      { name: "description", content: "Annual cross-parish youth reshuffle: nominations, automated pairing, and execution tracking." },
    ],
  }),
  component: MissionPage,
});

function MissionPage() {
  const qc = useQueryClient();
  const year = new Date().getFullYear();
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
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mission-nominees", weekId] });
    qc.invalidateQueries({ queryKey: ["mission-pairings", weekId] });
    qc.invalidateQueries({ queryKey: ["mission-analytics", weekId] });
  };
  const [nominateOpen, setNominateOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [reshuffleOpen, setReshuffleOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nominateMut = useMutation({
    mutationFn: (cdmId: string) => nominateYouth(weekId!, cdmId),
    onSuccess: () => { toast.success("Nominee added"); setNominateOpen(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
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

  const nominateFields: FieldDef[] = [
    { key: "cdmId", label: "CDM No.", placeholder: "CDM-2026-00001", required: true, full: true },
  ];

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
        title="Mission Week"
        action={
          <div className="flex items-center gap-1.5">
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!weekId || importMut.isPending}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-bg-2 px-2.5 text-[10px] font-semibold text-text-1 hover:border-gold-3 disabled:opacity-50"
            >
              <Upload className="h-3 w-3" /> Import
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={rows.length === 0}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-bg-2 px-2.5 text-[10px] font-semibold text-text-1 hover:border-gold-3 disabled:opacity-50"
            >
              <Download className="h-3 w-3" /> Export
            </button>
            <button
              type="button"
              onClick={() => setNominateOpen(true)}
              disabled={!weekId}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-bg-2 px-2.5 text-[10px] font-semibold text-text-1 hover:border-gold-3 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Nominate
            </button>
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
              className="inline-flex h-7 items-center gap-1 rounded-md bg-gold px-2.5 text-[10px] font-bold text-bg-1 hover:opacity-90 disabled:opacity-50"
            >
              <Shuffle className="h-3 w-3" /> {reshuffleMut.isPending ? "Reshuffling…" : "Run Reshuffle"}
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title={`Mission Week ${week?.year ?? year}`}
          description={week?.theme ?? "Annual cross-parish youth exchange. Add nominees, then run the reshuffle to auto-pair them with host parishes."}
        />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Nominees" value={String(analytics?.nominees ?? 0)} trend={`${nominees.length} loaded`} tone="up" />
          <Kpi label="Parishes" value={String(analytics?.parishes ?? 0)} trend="diocese-wide" tone="up" />
          <Kpi label="Reshuffle Pairs" value={String(analytics?.pairs ?? 0)} trend={pairings.length ? "generated" : "run reshuffle"} tone="info" />
          <Kpi label="Reports In" value={String(analytics?.reports ?? 0)} trend={`of ${pairings.length} pairs`} tone="warn" />
        </div>

        <Card>
          <CardHead
            title="Missionaries"
            subtitle={`${nominees.length} nominated · ${pairings.length} paired`}
          />
          <CardBody className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">CDM No.</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Name</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Source Parish</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Source Deanery</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Sent To Parish</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Sent To Deanery</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Status</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                    <td className="px-3.5 py-2.5 font-mono text-[10px] font-bold text-gold">{r.cdmId}</td>
                    <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">{r.name}</td>
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
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3.5 py-6 text-center text-[11px] text-text-3">
                      No nominees yet. Click “Nominate” to add a missionary by CDM No.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
      <RecordFormDialog
        open={nominateOpen}
        onOpenChange={setNominateOpen}
        title="Nominate Missionary"
        description="Enter the youth's CDM No. Their name, parish, and deanery will be fetched automatically."
        fields={nominateFields}
        submitLabel="Add Nominee"
        onSubmit={(values) => {
          const cdmId = values.cdmId?.trim();
          if (!cdmId) { toast.error("CDM No. is required"); return; }
          nominateMut.mutate(cdmId);
        }}
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
