import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, MoreVertical, Check } from "lucide-react";
import { Icon } from "@iconify/react";
import {
  createPatronage,
  deletePatronage,
  bulkDeletePatronage,
  getPatronage,
  listPatronagePaged,
  updatePatronage,
  type PatronageLevel,
  type Gender,
  type PatronageTeamRow,
  type PatronageTeamInput,
} from "@/lib/db/patronage";
import { fetchOrg, type OrgTree } from "@/lib/db/org";
import { useAdminScope } from "@/lib/hooks/use-admin-scope";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const patronageSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  level: fallback(z.enum(["outstation", "parish", "deanery", "diocese"]), "").default(""),
  gender: fallback(z.enum(["Male", "Female"]), "").default(""),
});
type PatronageSearch = z.infer<typeof patronageSearchSchema>;

const LEVELS: PatronageLevel[] = ["diocese", "deanery", "parish", "outstation"];
const LEVEL_LABELS: Record<PatronageLevel, string> = {
  diocese: "Diocese",
  deanery: "Deanery",
  parish: "Parish",
  outstation: "Outstation",
};

export const Route = createFileRoute("/admin/patronage")({
  validateSearch: zodValidator(patronageSearchSchema),
  head: () => ({
    meta: [
      { title: "Patronage Team — CDM Youth Office" },
      { name: "description", content: "Manage patrons and patronesses at all organizational levels." },
    ],
  }),
  component: PatronagePage,
});

const LEVELS: PatronageLevel[] = ["diocese", "deanery", "parish"];
const LEVEL_LABELS: Record<PatronageLevel, string> = {
  diocese: "Diocese",
  deanery: "Deanery",
  parish: "Parish",
  outstation: "Outstation",
};

function PatronagePage() {
  const [tab, setTab] = useState<PatronageLevel>("diocese");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PatronageTeamRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatronageTeamRow | null>(null);
  const qc = useQueryClient();

  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setFilter = (patch: Partial<PatronageSearch>) =>
    navigate({ search: (prev: PatronageSearch) => ({ ...prev, ...patch }), replace: true });

  const scope = useAdminScope();
  const deaneryId = scope.deaneryId;
  const parishId = scope.parishId;

  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: resp, isLoading } = useQuery({
    queryKey: [
      "patronage-team",
      tab,
      search.q,
      search.gender,
      deaneryId,
      parishId,
      page - 1,
      pageSize,
    ],
    queryFn: () =>
      listPatronagePaged({
        level: tab,
        gender: (search.gender as Gender) || undefined,
        page: page - 1,
        size: pageSize,
        q: search.q || undefined,
        deaneryId: tab === "diocese" ? null : deaneryId,
        parishId: tab === "parish" ? parishId : null,
      }),
    placeholderData: keepPreviousData,
  });

  const data = resp?.data ?? [];
  const total = resp?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["patronage-team"] });

  const createMut = useMutation({
    mutationFn: createPatronage,
    onSuccess: () => {
      toast.success("Patron/Patroness added");
      invalidate();
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PatronageTeamInput }) =>
      updatePatronage(id, input),
    onSuccess: () => {
      toast.success("Updated");
      invalidate();
      setEditTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deletePatronage,
    onSuccess: () => {
      toast.success("Archived");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Topbar
        title="Patronage Team"
        subtitle={`${total} patrons and patronesses`}
        tabs={
          <>
            {LEVELS.map((lvl) => (
              <TopbarTab
                key={lvl}
                active={tab === lvl}
                onClick={() => {
                  setTab(lvl);
                  setPage(1);
                }}
              >
                {LEVEL_LABELS[lvl]}
              </TopbarTab>
            ))}
          </>
        }
        action={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> Add {LEVEL_LABELS[tab]}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          <div className="border-b border-border bg-card px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search name, phone..."
                value={search.q}
                onChange={(e) => {
                  setFilter({ q: e.target.value });
                  setPage(1);
                }}
                className="h-8 flex-1 text-xs"
              />
              <Select value={search.gender} onValueChange={(v) => setFilter({ gender: v as Gender | "" })}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="Male">Patron</SelectItem>
                  <SelectItem value="Female">Patroness</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Gender</th>
                    <th className="px-3 py-2 text-left font-semibold">Level</th>
                    <th className="px-3 py-2 text-left font-semibold">Deanery</th>
                    <th className="px-3 py-2 text-left font-semibold">Parish</th>
                    <th className="px-3 py-2 text-left font-semibold">Phone</th>
                    <th className="px-3 py-2 text-left font-semibold">Email</th>
                    <th className="px-3 py-2 text-left font-semibold">Since</th>
                    <th className="px-3 py-2 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                        Loading...
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                        No {LEVEL_LABELS[tab].toLowerCase()} patrons found
                      </td>
                    </tr>
                  ) : (
                    data.map((patron) => (
                      <tr key={patron.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{patron.name}</td>
                        <td className="px-3 py-2 text-xs">
                          <span className={patron.gender === "Male" ? "text-blue-600" : "text-pink-600"}>
                            {patron.gender === "Male" ? "Patron" : "Patroness"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold capitalize">{patron.level}</td>
                        <td className="px-3 py-2 text-xs">{patron.deanery?.name || "—"}</td>
                        <td className="px-3 py-2 text-xs">{patron.parish?.name || "—"}</td>
                        <td className="px-3 py-2 text-xs">{patron.phone || "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{patron.email || "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(patron.start_date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditTarget(patron)}>
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-danger"
                                onClick={() => setDeleteTarget(patron)}
                              >
                                Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
        />
      </div>

      {/* Add/Edit Dialog */}
      <PatronageFormDialog
        open={addOpen || !!editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false);
            setEditTarget(null);
          }
        }}
        initial={editTarget || undefined}
        org={org}
        onSubmit={(input) => {
          if (editTarget) {
            updateMut.mutate({ id: editTarget.id, input });
          } else {
            createMut.mutate(input);
          }
        }}
        isLoading={createMut.isPending || updateMut.isPending}
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Patron/Patroness?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            This will archive {deleteTarget?.name}. This action can be undone by an admin.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="bg-danger"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}

/* ================================================================ */
/* FORM DIALOG                                                      */
/* ================================================================ */

interface PatronageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PatronageTeamRow;
  org?: OrgTree;
  onSubmit: (input: PatronageTeamInput) => void;
  isLoading?: boolean;
}

function PatronageFormDialog({
  open,
  onOpenChange,
  initial,
  org,
  onSubmit,
  isLoading,
}: PatronageFormDialogProps) {
  const [form, setForm] = useState<PatronageTeamInput>(
    initial || {
      name: "",
      phone: "",
      email: "",
      gender: "Female",
      level: "outstation",
    }
  );

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    onSubmit(form);
  };

  const getOrgUnits = () => {
    if (!org) return [];
    if (form.level === "diocese") return [];
    if (form.level === "deanery") return org.deaneries || [];
    if (form.level === "parish") {
      const deanery = form.deaneryId
        ? org.deaneries?.find((d) => d.id === form.deaneryId)
        : null;
      return deanery?.parishes || [];
    }
    if (form.level === "outstation") {
      const parish = form.parishId
        ? org.deaneries
            ?.flatMap((d) => d.parishes || [])
            .find((p) => p.id === form.parishId)
        : null;
      return parish?.outstations || [];
    }
    return [];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit" : "Add"} Patron/Patroness</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold">Gender *</label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as Gender })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Patron</SelectItem>
                  <SelectItem value="Female">Patroness</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">Org Level *</label>
              <Select
                value={form.level}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    level: v as PatronageLevel,
                    deaneryId: null,
                    parishId: null,
                    outstationId: null,
                  })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diocese">Diocese</SelectItem>
                  <SelectItem value="deanery">Deanery</SelectItem>
                  <SelectItem value="parish">Parish</SelectItem>
                  <SelectItem value="outstation">Outstation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deanery: always show, required for parish/outstation levels */}
          <div>
            <label className="text-xs font-semibold">
              Deanery {(form.level === "parish" || form.level === "outstation" || form.level === "deanery") && "*"}
            </label>
            <Select
              value={form.deaneryId || ""}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  deaneryId: v || null,
                  parishId: null,
                  outstationId: null,
                })
              }
              disabled={form.level === "diocese"}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select deanery" />
              </SelectTrigger>
              <SelectContent>
                {org?.deaneries?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parish: show for parish/outstation levels */}
          <div>
            <label className="text-xs font-semibold">
              Parish {(form.level === "parish" || form.level === "outstation") && "*"}
            </label>
            <Select
              value={form.parishId || ""}
              onValueChange={(v) =>
                setForm({ ...form, parishId: v || null, outstationId: null })
              }
              disabled={form.level === "diocese" || form.level === "deanery" || !form.deaneryId}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={form.deaneryId ? "Select parish" : "Select deanery first"} />
              </SelectTrigger>
              <SelectContent>
                {org?.parishes
                  ?.filter((p) => p.deanery_id === form.deaneryId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outstation: show only for outstation level */}
          <div>
            <label className="text-xs font-semibold">
              Outstation {form.level === "outstation" && "*"}
            </label>
            <Select
              value={form.outstationId || ""}
              onValueChange={(v) => setForm({ ...form, outstationId: v || null })}
              disabled={form.level !== "outstation" || !form.parishId}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={form.parishId ? "Select outstation" : "Select parish first"} />
              </SelectTrigger>
              <SelectContent>
                {org?.outstations
                  ?.filter((o) => o.parish_id === form.parishId)
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold">Phone</label>
            <Input
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone number"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold">Email</label>
            <Input
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email address"
              className="mt-1"
              type="email"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : initial ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
