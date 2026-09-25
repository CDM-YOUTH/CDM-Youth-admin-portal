import { useMemo, useState } from "react";
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
import { Topbar } from "@/components/admin/layout/topbar";
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

const filterValueSchema = fallback(
  z
    .object({
      operator: z.enum(["equals", "contains", "startsWith", "notEquals"]),
      value: z.string(),
    })
    .optional(),
  undefined,
);

const patronageSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  level: fallback(z.enum(["outstation", "parish", "deanery", "diocese"]), "").default(""),
  gender: fallback(z.enum(["Male", "Female"]), "").default(""),
  deanery_id: fallback(z.string(), "").default(""),
  parish_id: fallback(z.string(), "").default(""),
  outstation_id: fallback(z.string(), "").default(""),
  page: fallback(z.number().int().min(1), 1).default(1),
  size: fallback(z.number().int().min(1).max(100), 10).default(10),
  f_patron_number: filterValueSchema,
  f_name: filterValueSchema,
  f_gender: filterValueSchema,
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


function PatronagePage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PatronageTeamRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatronageTeamRow | null>(null);
  const qc = useQueryClient();

  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setFilter = (patch: Partial<PatronageSearch>) => {
    navigate({ search: (prev: PatronageSearch) => ({ ...prev, ...patch, page: 1 }), replace: true });
  };

  const scope = useAdminScope();
  const deaneryId = scope.deaneryId || search.deanery_id;
  const parishId = scope.parishId || search.parish_id;
  const outstationId = scope.outstationId || search.outstation_id;

  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });

  const { data: resp, isLoading } = useQuery({
    queryKey: [
      "patronage-team",
      search.page - 1,
      search.size,
      search.q,
      search.level,
      search.gender,
      deaneryId,
      parishId,
      outstationId,
    ],
    queryFn: () =>
      listPatronagePaged({
        level: (search.level as PatronageLevel) || undefined,
        gender: (search.gender as Gender) || undefined,
        page: search.page - 1,
        size: search.size,
        q: search.q || undefined,
        deaneryId: deaneryId || null,
        parishId: parishId || null,
        outstationId: outstationId || null,
      }),
    placeholderData: keepPreviousData,
  });

  const data = resp?.data ?? [];
  const total = resp?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / search.size));

  // Client-side column filters applied on the current page only
  const displayRows = useMemo(() => {
    if (!search.f_patron_number && !search.f_name && !search.f_gender) return data;
    return data.filter((row) => {
      if (!applyColumnFilter(row.patron_number || "", search.f_patron_number)) return false;
      if (!applyColumnFilter(row.name, search.f_name)) return false;
      if (!applyColumnFilter(row.gender, search.f_gender)) return false;
      return true;
    });
  }, [data, search.f_patron_number, search.f_name, search.f_gender]);

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

  // Org dropdowns use UUIDs as values (from live Supabase org tree)
  const deaneryOptions = (org?.deaneries ?? []).map((d) => ({ value: d.id, label: d.name }));
  const parishOptions = (org?.parishes ?? [])
    .filter((p) => !deaneryId || p.deanery_id === deaneryId)
    .map((p) => ({ value: p.id, label: p.name }));
  const outstationOptions = (org?.outstations ?? [])
    .filter((o) => !parishId || o.parish_id === parishId)
    .map((o) => ({ value: o.id, label: o.name }));

  const fc = (
    key: keyof PatronageSearch,
    label: string,
    mode: "text" | "select" = "text",
    options?: { value: string; label: string }[],
  ) => (
    <ColumnFilter
      label={label}
      mode={mode}
      options={options}
      value={search[key] as ColumnFilterValue | undefined}
      onChange={(v) => setFilter({ [key]: v } as Partial<PatronageSearch>)}
    />
  );

  return (
    <>
      <Topbar
        title="Patronage Team"
        subtitle={`${total} patrons and patronesses`}
        action={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> Add Patron
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          <TableToolbar
            searchValue={search.q}
            onSearchChange={(value) => setFilter({ q: value })}
            searchPlaceholder="Search name, patron number, phone..."
          />

          <CardBody className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Patron No." filter={fc("f_patron_number", "Patron No.")} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Name" filter={fc("f_name", "Name")} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Gender"
                      filter={fc(
                        "f_gender",
                        "Gender",
                        "select",
                        [
                          { value: "Male", label: "Patron" },
                          { value: "Female", label: "Patroness" },
                        ],
                      )}
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Level"
                      filter={
                        <ColumnFilter
                          label="Level"
                          mode="select"
                          options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
                          value={
                            search.level ? { operator: "equals", value: search.level } : undefined
                          }
                          onChange={(v) => setFilter({ level: v?.value ?? "" })}
                        />
                      }
                    />
                  </th>
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
                            setFilter({
                              deanery_id: v?.value ?? "",
                              parish_id: "",
                              outstation_id: "",
                            })
                          }
                          disabled={!!scope.deaneryId}
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
                          onChange={(v) => setFilter({ parish_id: v?.value ?? "", outstation_id: "" })}
                          disabled={!!scope.parishId}
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
                          value={
                            outstationId ? { operator: "equals", value: outstationId } : undefined
                          }
                          onChange={(v) => setFilter({ outstation_id: v?.value ?? "" })}
                          disabled={!!scope.outstationId}
                        />
                      }
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Phone</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Email</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Since</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="px-3.5 py-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3.5 py-8 text-center text-muted-foreground">
                      No patrons found
                    </td>
                  </tr>
                ) : (
                  displayRows.map((patron) => (
                    <tr key={patron.id} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                      <td className="px-3.5 py-2.5 font-mono text-[10px] font-bold text-gold">
                        {patron.patron_number || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                        {patron.name}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px]">
                        <span className={patron.gender === "Male" ? "text-blue-600" : "text-pink-600"}>
                          {patron.gender === "Male" ? "Patron" : "Patroness"}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] font-semibold capitalize">
                        {LEVEL_LABELS[patron.level]}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-text-2">
                        {patron.deanery?.name || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-text-1">
                        {patron.parish?.name || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-text-2">
                        {patron.outstation?.name || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-text-1">
                        {patron.phone || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-text-2">
                        {patron.email || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-text-2">
                        {new Date(patron.start_date).toLocaleDateString()}
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
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => setEditTarget(patron)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-danger focus:text-danger"
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
            <TablePagination
              page={search.page}
              pageSize={search.size}
              total={total}
              totalPages={totalPages}
              onPageChange={(p) =>
                navigate({ search: (prev: PatronageSearch) => ({ ...prev, page: p }), replace: true })
              }
              onPageSizeChange={(s) =>
                navigate({
                  search: (prev: PatronageSearch) => ({ ...prev, size: s, page: 1 }),
                  replace: true,
                })
              }
            />
          </CardBody>
        </Card>
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
