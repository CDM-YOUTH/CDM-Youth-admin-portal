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
  const [cdm, setCdm] = useState("");
  const nominateMut = useMutation({
    mutationFn: (cdmId: string) => nominateYouth(weekId!, cdmId),
    onSuccess: () => { toast.success("Nominee added"); setCdm(""); invalidate(); },
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

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card>
            <CardHead title="Nominees" subtitle="Add by CDM No." />
            <CardBody className="space-y-2">
              <form
                className="flex gap-2"
                onSubmit={(e) => { e.preventDefault(); if (cdm.trim()) nominateMut.mutate(cdm.trim()); }}
              >
                <Input value={cdm} onChange={(e) => setCdm(e.target.value)} placeholder="CDM-2026-00001" />
                <button
                  type="submit"
                  disabled={!weekId || nominateMut.isPending}
                  className="rounded-lg border border-border bg-gold px-3 py-1.5 text-[11px] font-bold text-bg-1"
                >
                  Add
                </button>
              </form>
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {nominees.length === 0 && <div className="text-[11px] text-text-3">No nominees yet.</div>}
                {nominees.map((n) => (
                  <div key={n.id} className="flex items-center gap-2 rounded-lg border border-border bg-bg-2 p-2 text-[11px]">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-semibold text-text-1">{n.youth?.full_name ?? "—"}</div>
                      <div className="text-[9px] text-text-3">{n.youth?.cdm_id} · {n.youth?.parish?.name ?? "No parish"}</div>
                    </div>
                    <Pill tone="neutral">{n.status}</Pill>
                    <button
                      onClick={() => removeMut.mutate(n.id)}
                      className="rounded border border-border p-1 text-text-3 hover:border-danger/50 hover:text-danger"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Reshuffle Preview" subtitle={`${pairings.length} pairings`} />
            <CardBody className="space-y-1.5 max-h-96 overflow-y-auto">
              {pairings.length === 0 && (
                <div className="text-[11px] text-text-3">No pairings yet — add nominees and click “Run Reshuffle”.</div>
              )}
              {pairings.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-2.5 text-[11px]">
                  <span className="font-semibold text-foreground flex-1 truncate">{p.youth?.full_name ?? "—"}</span>
                  <span className="text-text-3 truncate">{p.youth?.parish?.name ?? "—"}</span>
                  <span className="text-gold">→</span>
                  <span className="font-semibold text-text-1 truncate">{p.host_parish?.name ?? "Host parish"}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
