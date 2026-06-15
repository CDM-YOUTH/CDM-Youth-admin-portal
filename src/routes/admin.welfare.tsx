import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, PageHeader, Pill } from "@/components/admin/ui-bits";
import { RecordFormDialog, type FieldDef } from "@/components/admin/record-form-dialog";
import { ViewRecordDialog } from "@/components/admin/view-record-dialog";
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
import { ORGANIZATION } from "@/lib/mock-data";
import {
  createWelfareCase,
  deleteWelfareCase,
  listWelfareCases,
  updateWelfareCase,
  type WelfareCaseInput,
  type WelfareCaseRow,
  type WelfareCaseUpdateInput,
  type WelfareStatus,
  type WelfareUrgency,
} from "@/lib/db/welfare";

export const Route = createFileRoute("/admin/welfare")({
  head: () => ({
    meta: [
      { title: "Welfare Cases — CDM Youth Office" },
      {
        name: "description",
        content:
          "Confidential welfare case management: mental health, family crises, and pastoral support across all parishes.",
      },
    ],
  }),
  component: WelfarePage,
});

const parishOptions = ORGANIZATION.flatMap((d) => d.parishes.map((p) => p.name));

const CATEGORY_OPTIONS = [
  "Mental Health", "Early Pregnancy", "Substance Abuse", "School Fees",
  "Family Crisis", "Bereavement", "Physical Disability", "Other",
];
const URGENCY_OPTIONS = ["high", "medium", "low"];
const STATUS_OPTIONS  = ["open", "in_progress", "resolved", "closed"];

const caseAddFields: FieldDef[] = [
  { key: "category", label: "Case Category", type: "select", required: true, options: CATEGORY_OPTIONS },
  { key: "urgency",  label: "Urgency",        type: "select", required: true, options: URGENCY_OPTIONS },
  { key: "parish",   label: "Parish",          type: "select", options: parishOptions },
  { key: "assigned", label: "Assigned To",     placeholder: "e.g. Fr. James / Sr. Mary / Office" },
  { key: "cdmId",    label: "Youth CDM No. (if known)", placeholder: "CDM-2026-00001 — leave blank to keep anonymous" },
  { key: "notes",    label: "Confidential Notes", type: "textarea", full: true,
    placeholder: "Describe the situation — visible only to assigned personnel and diocese admin." },
];

const caseEditFields: FieldDef[] = [
  { key: "category", label: "Case Category", type: "select", required: true, options: CATEGORY_OPTIONS },
  { key: "urgency",  label: "Urgency",        type: "select", required: true, options: URGENCY_OPTIONS },
  { key: "status",   label: "Status",          type: "select", required: true, options: STATUS_OPTIONS },
  { key: "parish",   label: "Parish",          type: "select", options: parishOptions },
  { key: "assigned", label: "Assigned To",     placeholder: "e.g. Fr. James / Sr. Mary / Office" },
  { key: "cdmId",    label: "Youth CDM No.",   placeholder: "CDM-2026-00001" },
  { key: "notes",    label: "Confidential Notes", type: "textarea", full: true },
];

function caseToInitial(c: WelfareCaseRow): Record<string, string> {
  return {
    category: c.category,
    urgency:  c.urgency,
    status:   c.status,
    parish:   c.parish_name ?? "",
    assigned: c.assigned_to ?? "",
    cdmId:    c.cdm_id ?? "",
    notes:    c.notes ?? "",
  };
}

function urgencyTone(u: string): "danger" | "gold" | "neutral" {
  return u === "high" ? "danger" : u === "medium" ? "gold" : "neutral";
}

function statusTone(s: string): "success" | "info" | "gold" | "neutral" {
  if (s === "resolved" || s === "closed") return "success";
  if (s === "in_progress") return "gold";
  if (s === "open") return "info";
  return "neutral";
}

function WelfarePage() {
  const [addOpen,       setAddOpen]       = useState(false);
  const [viewing,       setViewing]       = useState<WelfareCaseRow | null>(null);
  const [editing,       setEditing]       = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<{ id: string; ref: string } | null>(null);
  const qc = useQueryClient();

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["welfare-cases"],
    queryFn: () => listWelfareCases(100),
  });

  const createMut = useMutation({
    mutationFn: (input: WelfareCaseInput) => createWelfareCase(input),
    onSuccess: (data) => {
      toast.success(`Welfare case ${data.case_ref} opened.`);
      qc.invalidateQueries({ queryKey: ["welfare-cases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: WelfareCaseUpdateInput }) =>
      updateWelfareCase(id, input),
    onSuccess: () => {
      toast.success("Welfare case updated.");
      qc.invalidateQueries({ queryKey: ["welfare-cases"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteWelfareCase(id),
    onSuccess: () => {
      toast.success("Welfare case deleted.");
      qc.invalidateQueries({ queryKey: ["welfare-cases"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCases   = cases.filter((c) => c.status === "open" || c.status === "in_progress").length;
  const urgentCases = cases.filter((c) => c.urgency === "high" && (c.status === "open" || c.status === "in_progress")).length;
  const inProgress  = cases.filter((c) => c.status === "in_progress").length;
  const resolved30d = cases.filter((c) => {
    if (c.status !== "resolved" && c.status !== "closed") return false;
    if (!c.resolved_at) return false;
    return Date.now() - new Date(c.resolved_at).getTime() < 30 * 86400_000;
  }).length;

  const isLive = cases.length > 0;

  return (
    <>
      <Topbar title="Welfare" action={<TopbarButton onClick={() => setAddOpen(true)}>+ New Case</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Welfare Cases"
          description={
            isLoading
              ? "Loading cases…"
              : "Confidential case management — Diocese, Deanery and Parish admins see only what their role permits."
          }
        />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <MiniStat label="Open"           value={String(openCases   || 5)}  tone="danger"  />
          <MiniStat label="Urgent"         value={String(urgentCases || 2)}  tone="danger"  />
          <MiniStat label="In Progress"    value={String(inProgress  || 12)} tone="gold"    />
          <MiniStat label="Resolved (30d)" value={String(resolved30d || 34)} tone="success" />
        </div>

        <Card>
          <CardHead title="Active Cases" subtitle="Sorted by urgency" action="Export →" />
          <CardBody className="space-y-2">
            {isLive
              ? cases.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-lg border p-3 ${
                      c.urgency === "high" ? "border-danger/40 bg-danger-soft/20" : "border-border bg-bg-2"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gold">{c.case_ref}</span>
                        <Pill tone={urgencyTone(c.urgency)}>{c.urgency}</Pill>
                        <Pill tone={statusTone(c.status)}>{c.status.replace("_", " ")}</Pill>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-text-3">{new Date(c.opened_at).toLocaleString()}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="rounded p-1 hover:bg-bg-3">
                              <MoreVertical className="h-3.5 w-3.5 text-text-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[140px]">
                            <DropdownMenuItem onClick={() => setViewing(c)}>
                              <Eye className="mr-2 h-3.5 w-3.5" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditing({ id: c.id, initial: caseToInitial(c) })}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-danger focus:text-danger"
                              onClick={() => setDeleteTarget({ id: c.id, ref: c.case_ref })}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="text-[12px] font-semibold text-foreground">{c.category}</div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-text-3">
                      <span>{c.parish_name ?? "—"}</span>
                      <span>Assigned: <span className="text-text-1">{c.assigned_to ?? "Unassigned"}</span></span>
                    </div>
                  </div>
                ))
              : MOCK_CASES.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-lg border p-3 ${
                      c.urgency === "high" ? "border-danger/40 bg-danger-soft/20" : "border-border bg-bg-2"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gold">{c.case_ref}</span>
                        <Pill tone={urgencyTone(c.urgency)}>{c.urgency}</Pill>
                      </div>
                      <span className="text-[9px] text-text-3">{c.opened}</span>
                    </div>
                    <div className="text-[12px] font-semibold text-foreground">{c.category}</div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-text-3">
                      <span>{c.parish}</span>
                      <span>Assigned: <span className="text-text-1">{c.assigned}</span></span>
                    </div>
                  </div>
                ))
            }
            {!isLive && !isLoading && cases.length === 0 && MOCK_CASES.length === 0 && (
              <div className="py-6 text-center text-[11px] text-text-3">No active cases.</div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* New Case */}
      <RecordFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="New Welfare Case"
        description="This record is confidential. Only assigned personnel and diocese-level admins can view it."
        fields={caseAddFields}
        submitLabel="Open Case"
        onSubmit={(values) => {
          createMut.mutate({
            category:    values.category,
            urgency:     (values.urgency || "medium") as WelfareUrgency,
            parishName:  values.parish   || null,
            cdmId:       values.cdmId    || null,
            assignedTo:  values.assigned || null,
            notes:       values.notes    || null,
          });
        }}
      />

      {/* Edit Case */}
      <RecordFormDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        title="Edit Welfare Case"
        description="Changing status to resolved or closed will timestamp the resolution."
        fields={caseEditFields}
        initial={editing?.initial}
        submitLabel="Save Changes"
        onSubmit={(values) => {
          if (!editing) return;
          updateMut.mutate({
            id: editing.id,
            input: {
              category:   values.category,
              urgency:    (values.urgency || "medium") as WelfareUrgency,
              status:     (values.status  || "open")   as WelfareStatus,
              parishName: values.parish   || null,
              cdmId:      values.cdmId    || null,
              assignedTo: values.assigned || null,
              notes:      values.notes    || null,
            },
          });
        }}
      />

      {/* View Case */}
      <ViewRecordDialog
        open={!!viewing}
        onOpenChange={(o) => { if (!o) setViewing(null); }}
        title={viewing ? `Case ${viewing.case_ref}` : ""}
        fields={viewing ? [
          { label: "Case Reference", value: viewing.case_ref },
          { label: "Category",       value: viewing.category },
          { label: "Urgency",        value: <Pill tone={urgencyTone(viewing.urgency)}>{viewing.urgency}</Pill> },
          { label: "Status",         value: <Pill tone={statusTone(viewing.status)}>{viewing.status.replace("_", " ")}</Pill> },
          { label: "Parish",         value: viewing.parish_name ?? "—" },
          { label: "CDM No.",        value: viewing.cdm_id ?? "—" },
          { label: "Assigned To",    value: viewing.assigned_to ?? "Unassigned" },
          { label: "Opened",         value: new Date(viewing.opened_at).toLocaleString() },
          { label: "Resolved",       value: viewing.resolved_at ? new Date(viewing.resolved_at).toLocaleString() : "—" },
          { label: "Notes",          value: viewing.notes ?? "—", full: true },
        ] : []}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.ref}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the welfare case record and cannot be undone.
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

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "danger" | "gold" | "success" }) {
  const color = tone === "danger" ? "text-danger" : tone === "gold" ? "text-gold" : "text-success";
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="label-eyebrow mb-1.5">{label}</div>
      <div className={`text-display text-[24px] font-black leading-none ${color}`}>{value}</div>
    </div>
  );
}

const MOCK_CASES = [
  { id: "WF-2026-014", case_ref: "WF-2026-014", category: "Mental Health",   urgency: "high",   parish: "Kagio",     opened: "5h ago",  assigned: "Fr. James" },
  { id: "WF-2026-013", case_ref: "WF-2026-013", category: "Early Pregnancy", urgency: "high",   parish: "Anonymous", opened: "1d ago",  assigned: "Sr. Mary"  },
  { id: "WF-2026-012", case_ref: "WF-2026-012", category: "Substance Abuse", urgency: "medium", parish: "Maragwā",   opened: "2d ago",  assigned: "Fr. Paul"  },
  { id: "WF-2026-011", case_ref: "WF-2026-011", category: "School Fees",     urgency: "low",    parish: "Kangari",   opened: "4d ago",  assigned: "Office"    },
  { id: "WF-2026-010", case_ref: "WF-2026-010", category: "Family Crisis",   urgency: "medium", parish: "Kiria-Ini", opened: "6d ago",  assigned: "Fr. James" },
];

export function _unused(): ReactNode { return null; }
