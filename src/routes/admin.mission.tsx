import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
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
import { MoreVertical, Trash2 } from "lucide-react";
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
  listMissionPhases,
  nominateYouth,
  removeNominee,
  setPhaseStatus,
  type MissionPhase,
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
  const { data: phases = [] } = useQuery({
    queryKey: ["mission-phases", weekId],
    queryFn: () => listMissionPhases(weekId!),
    enabled: !!weekId,
  });
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
    onSuccess: (n) => { toast.success(`Generated ${n} pairings`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const phaseMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MissionPhase["status"] }) => setPhaseStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mission-phases", weekId] }),
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

  const daysToExecution = (() => {
    const exec = phases.find((p) => /execution/i.test(p.name));
    if (!exec?.phase_date) return "—";
    const m = exec.phase_date.match(/\d{2}\s+\w{3}/);
    return m ? `Phase ${exec.position}` : "—";
  })();

  return (
    <>
      <Topbar
        title="Mission Week"
        action={
          <TopbarButton
            onClick={() => {
              if (!weekId || reshuffleMut.isPending || nominees.length === 0) return;
              reshuffleMut.mutate();
            }}
          >
            {reshuffleMut.isPending ? "Reshuffling…" : "Run Reshuffle"}
          </TopbarButton>
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
          <Kpi label="Reports In" value={String(analytics?.reports ?? 0)} trend={daysToExecution} tone="warn" />
        </div>

        <Card className="mb-4">
          <CardHead title="Phase Tracker" subtitle="Click a phase to advance its status" />
          <CardBody className="space-y-1.5">
            {phases.length === 0 && (
              <div className="text-[11px] text-text-3">Loading phases…</div>
            )}
            {phases.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const next: MissionPhase["status"] =
                    p.status === "upcoming" ? "active" : p.status === "active" ? "done" : "upcoming";
                  phaseMut.mutate({ id: p.id, status: next });
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-bg-2 px-3 py-2.5 text-left hover:border-gold-3"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background:
                      p.status === "done"
                        ? "var(--color-success)"
                        : p.status === "active"
                          ? "var(--color-gold)"
                          : "var(--color-bg-4)",
                  }}
                />
                <div className="flex-1">
                  <div className="text-[11px] font-semibold text-text-1">Phase {p.position} — {p.name}</div>
                  <div className="text-[9px] text-text-3">{p.phase_date ?? ""}</div>
                </div>
                <Pill tone={p.status === "done" ? "success" : p.status === "active" ? "gold" : "neutral"}>
                  {p.status}
                </Pill>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Missionaries"
            subtitle={`${nominees.length} nominated · ${pairings.length} paired`}
            action={
              <button
                type="button"
                onClick={() => setNominateOpen(true)}
                disabled={!weekId}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-gold px-2.5 text-[10px] font-bold text-bg-1 hover:opacity-90 disabled:opacity-50"
              >
                + Nominate
              </button>
            }
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
    </>
  );
}
