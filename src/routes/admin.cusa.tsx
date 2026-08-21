import { useEffect, useMemo, useRef, useState } from "react";
import { titleCase } from "@/lib/utils";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Icon } from "@iconify/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { type PagedResponse } from "@/lib/api/fetch-api";
import { Topbar } from "@/components/admin/layout/topbar";
import { Card, CardBody, Pill } from "@/components/admin/composables/ui-bits";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CUSA_INSTITUTIONS } from "@/lib/cusa-data";
import {
  createCusaMember,
  deleteCusaMember,
  listCusaPaged,
  syncTertiaryYouthsToCusa,
  updateCusaMember,
  type CusaRow,
} from "@/lib/db/youth-records/cusa";
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
import { TablePagination } from "@/components/admin/composables/tables/table-pagination";
import {
  ColumnFilter,
  ColumnHeader,
  TableToolbar,
  applyColumnFilter,
  type ColumnFilterValue,
} from "@/components/admin/composables/tables/table-filters";
import { RecordFormDialog } from "@/components/admin/composables/forms/record-form-dialog";
import {
  YouthSearchInput,
  type PickedYouth,
} from "@/components/admin/composables/pickers/youth-search-input";
import { fetchOrg, type OrgTree } from "@/lib/db/org";
import { AddYouthDialog, type AddYouthResult } from "@/components/admin/youth/add-youth-dialog";
import { useAdminScope } from "@/lib/hooks/use-admin-scope";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const filterValueSchema = fallback(
  z
    .object({
      operator: z.enum(["equals", "contains", "startsWith", "notEquals"]),
      value: z.string(),
    })
    .optional(),
  undefined,
);

const cusaSearchSchema = z.object({
  // Server-side params
  q: fallback(z.string(), "").default(""),
  institution: fallback(z.string(), "").default(""),
  deanery_id: fallback(z.string(), "").default(""),
  parish_id: fallback(z.string(), "").default(""),
  outstation_id: fallback(z.string(), "").default(""),
  year: fallback(z.number().int(), new Date().getFullYear()).default(new Date().getFullYear()),
  page: fallback(z.number().int().min(1), 1).default(1),
  size: fallback(z.number().int().min(1).max(100), 10).default(10),
  // Client-side filters on current page
  f_cdm: filterValueSchema,
  f_name: filterValueSchema,
  f_gender: filterValueSchema,
  f_status: filterValueSchema,
});

type CusaSearch = z.infer<typeof cusaSearchSchema>;

export const Route = createFileRoute("/admin/cusa")({
  head: () => ({
    meta: [
      { title: "CUSA — CDM Youth Office" },
      {
        name: "description",
        content: "Colleges and Universities Students Association: chapters, members, and events.",
      },
    ],
  }),
  validateSearch: zodValidator(cusaSearchSchema),
  component: CusaPage,
});

function CusaPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [addOpen, setAddOpen] = useState(false);
  const [addYouthOpen, setAddYouthOpen] = useState(false);
  const [editing, setEditing] = useState<null | {
    id: string;
    name: string;
    values: Record<string, string>;
  }>(null);
  const [deleteTarget, setDeleteTarget] = useState<null | { id: string; name: string }>(null);
  const qc = useQueryClient();
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    syncTertiaryYouthsToCusa()
      .then(() => qc.invalidateQueries({ queryKey: ["cusa"] }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scope = useAdminScope();
  // Scope takes precedence over URL params — scoped users can't widen their view
  const deaneryId = scope.deaneryId || search.deanery_id;
  const parishId = scope.parishId || search.parish_id;
  const outstationId = scope.outstationId || search.outstation_id;

  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const { data: resp, isLoading } = useQuery({
    queryKey: [
      "cusa",
      search.page - 1,
      search.size,
      search.q,
      search.institution,
      deaneryId,
      parishId,
      outstationId,
      search.year,
    ],
    queryFn: () =>
      listCusaPaged({
        page: search.page - 1,
        size: search.size,
        q: search.q,
        year: search.year || null,
        institution: search.institution || null,
        deaneryId: deaneryId || null,
        parishId: parishId || null,
        outstationId: outstationId || null,
      }),
    placeholderData: keepPreviousData,
  });
  const total = resp?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / search.size));
  const createMut = useMutation({
    mutationFn: (vals: {
      cdmId?: string | null;
      fullName: string;
      gender: "Female" | "Male";
      age?: number;
      phone?: string;
      email?: string;
      deaneryName?: string;
      parishName?: string;
      outstationName?: string;
      institution: string;
      course?: string;
      yearOfStudy?: string;
      leadershipRole?: string;
    }) => createCusaMember(vals),
    onSuccess: () => {
      toast.success("CUSA member saved");
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["cusa"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, string> }) =>
      updateCusaMember(id, {
        institution: values.institution,
        course: values.course || null,
        yearOfStudy: values.year || null,
        leadershipRole: values.role || null,
      }),
    onSuccess: () => {
      toast.success("CUSA member updated");
      qc.invalidateQueries({ queryKey: ["cusa"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCusaMember(id),
    onSuccess: () => {
      toast.success("CUSA member removed");
      qc.invalidateQueries({ queryKey: ["cusa"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const setFilter = (patch: Partial<CusaSearch>) => {
    navigate({ search: (prev: CusaSearch) => ({ ...prev, ...patch, page: 1 }), replace: true });
  };

  const allMembers = useMemo(
    () =>
      (resp?.data ?? []).map((m) => ({
        id: m.id,
        cdmId: m.youth?.cdm_id ?? "",
        name: m.youth?.full_name ?? "",
        gender: m.youth?.gender ?? "",
        institution: m.institution,
        course: m.course ?? "",
        year: m.year_of_study ?? "",
        deaneryName: m.youth?.deanery?.name ?? "",
        parishName: m.youth?.parish?.name ?? "",
        outstationName: m.youth?.outstation?.name ?? "",
        status: m.leadership_role ? "active" : "reporting",
      })),
    [resp],
  );

  // Client-side column filters on current page
  const displayMembers = useMemo(() => {
    if (!search.f_cdm && !search.f_name && !search.f_gender && !search.f_status) return allMembers;
    return allMembers.filter((m) => {
      if (!applyColumnFilter(m.cdmId, search.f_cdm)) return false;
      if (!applyColumnFilter(m.name, search.f_name)) return false;
      if (!applyColumnFilter(m.gender, search.f_gender)) return false;
      if (!applyColumnFilter(m.status, search.f_status)) return false;
      return true;
    });
  }, [allMembers, search.f_cdm, search.f_name, search.f_gender, search.f_status]);

  const deaneryOptions = (org?.deaneries ?? []).map((d) => ({ value: d.id, label: d.name }));
  const parishOptions = (org?.parishes ?? [])
    .filter((p) => !deaneryId || p.deanery_id === deaneryId)
    .map((p) => ({ value: p.id, label: p.name }));
  const outstationOptions = (org?.outstations ?? [])
    .filter((o) => !parishId || o.parish_id === parishId)
    .map((o) => ({ value: o.id, label: o.name }));

  const fc = (
    key: keyof CusaSearch,
    label: string,
    mode: "text" | "select" = "text",
    options?: { value: string; label: string }[],
  ) => (
    <ColumnFilter
      label={label}
      mode={mode}
      options={options}
      value={search[key] as ColumnFilterValue | undefined}
      onChange={(v) => setFilter({ [key]: v } as Partial<CusaSearch>)}
    />
  );

  return (
    <>
      <Topbar
        title={
          <>
            <span className="hidden sm:inline">Colleges & Universities Students Association (CUSA)</span>
            <span className="sm:hidden">CUSA</span>
          </>
        }
        description={
          isLoading
            ? "Loading CUSA members…"
            : `${displayMembers.length.toLocaleString()} of ${allMembers.length.toLocaleString()} members shown — share this URL to share the same view.`
        }
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddYouthOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[11px] font-bold text-white transition hover:opacity-90"
            >
              <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> Add Youth
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[11px] font-bold text-white transition hover:opacity-90"
            >
              <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> Add Member
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          <TableToolbar
            searchValue={search.q}
            onSearchChange={(value) => setFilter({ q: value })}
            searchPlaceholder="Search name, CDM No.…"
            onImport={() => toast.info("Import CUSA members — bring CSV soon")}
            onExport={() => toast.success(`Exporting ${displayMembers.length} CUSA members`)}
          />
          <CardBody className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader label="CDM No." filter={fc("f_cdm", "CDM No.")} />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader label="Name" filter={fc("f_name", "Name")} />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader
                      label="Institution"
                      filter={
                        <ColumnFilter
                          label="Institution"
                          mode="select"
                          options={CUSA_INSTITUTIONS.map((i) => ({ value: i, label: i }))}
                          value={
                            search.institution
                              ? { operator: "equals", value: search.institution }
                              : undefined
                          }
                          onChange={(v) => setFilter({ institution: v?.value ?? "" })}
                        />
                      }
                    />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
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
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader
                      label="Parish"
                      filter={
                        <ColumnFilter
                          label="Parish"
                          mode="select"
                          options={parishOptions}
                          value={parishId ? { operator: "equals", value: parishId } : undefined}
                          onChange={(v) =>
                            setFilter({ parish_id: v?.value ?? "", outstation_id: "" })
                          }
                          disabled={!!scope.parishId}
                        />
                      }
                    />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
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
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader
                      label="Gender"
                      filter={fc("f_gender", "Gender", "select", [
                        { value: "Female", label: "Female" },
                        { value: "Male", label: "Male" },
                      ])}
                    />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">Course</TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader
                      label="Status"
                      filter={fc("f_status", "Status", "select", [
                        { value: "active", label: "Active" },
                        { value: "reporting", label: "Reporting" },
                      ])}
                    />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayMembers.map((member) => (
                  <TableRow key={member.id} className="border-border/30 hover:bg-bg-3">
                    <TableCell className="px-3 py-2 font-mono text-[10px] font-bold text-violet">
                      {member.cdmId}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[11px] font-semibold text-foreground">
                      {titleCase(member.name)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-1">
                      {member.institution}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">
                      {member.deaneryName}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">
                      {member.parishName}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">
                      {member.outstationName}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">
                      {member.gender}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">
                      {member.course} · {member.year}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Pill tone={member.status === "active" ? "success" : "violet"}>
                        {member.status}
                      </Pill>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Row actions"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-2 text-text-2 hover:border-violet hover:text-violet"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() =>
                              setEditing({
                                id: member.id,
                                name: member.name,
                                values: {
                                  institution: member.institution,
                                  course: member.course,
                                  year: member.year,
                                  role: "",
                                },
                              })
                            }
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-danger focus:text-danger"
                            onClick={() => setDeleteTarget({ id: member.id, name: member.name })}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {displayMembers.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="px-3 py-6 text-center text-[11px] text-text-3"
                    >
                      No CUSA members match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              page={search.page}
              pageSize={search.size}
              total={total}
              totalPages={totalPages}
              onPageChange={(p) =>
                navigate({ search: (prev: CusaSearch) => ({ ...prev, page: p }), replace: true })
              }
              onPageSizeChange={(s) =>
                navigate({
                  search: (prev: CusaSearch) => ({ ...prev, size: s, page: 1 }),
                  replace: true,
                })
              }
            />
          </CardBody>
        </Card>
      </div>
      {org && (
        <AddYouthDialog
          open={addYouthOpen}
          onClose={() => setAddYouthOpen(false)}
          org={org}
          onSuccess={(_youth: AddYouthResult) => {
            setAddYouthOpen(false);
            qc.invalidateQueries({ queryKey: ["cusa"] });
            qc.invalidateQueries({ queryKey: ["youths"] });
          }}
        />
      )}
      <AddCusaDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        org={org}
        isPending={createMut.isPending}
        onSubmit={(vals) => createMut.mutate(vals)}
      />
      <RecordFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={`Edit CUSA · ${editing?.name ?? ""}`}
        description="Update institution, course, year, or leadership role. Personal info edits go in Youth Records."
        fields={[
          {
            key: "institution",
            label: "Institution",
            type: "select",
            options: [...CUSA_INSTITUTIONS],
            required: true,
          },
          { key: "course", label: "Course", placeholder: "e.g. Education" },
          {
            key: "year",
            label: "Year of study",
            type: "select",
            options: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
          },
          { key: "role", label: "Leadership role (optional)", placeholder: "e.g. Chairperson" },
        ]}
        initial={editing?.values}
        submitLabel="Save changes"
        onSubmit={(values) => {
          if (editing) updateMut.mutate({ id: editing.id, values });
          setEditing(null);
        }}
      />
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove CUSA member?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the CUSA membership for <strong>{deleteTarget?.name}</strong>. The youth
              record itself is not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMut.mutate(deleteTarget.id);
                setDeleteTarget(null);
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

/* ------------------------------------------------------------------ */
/* Add CUSA member dialog                                              */
/* ------------------------------------------------------------------ */

function AddCusaDialog({
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
  onSubmit: (vals: {
    cdmId?: string | null;
    fullName: string;
    gender: "Female" | "Male";
    age?: number;
    phone?: string;
    email?: string;
    deaneryName?: string;
    parishName?: string;
    outstationName?: string;
    institution: string;
    course?: string;
    yearOfStudy?: string;
    leadershipRole?: string;
  }) => void;
}) {
  const [youth, setYouth] = useState<PickedYouth | null>(null);
  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (open) {
      setYouth(null);
      setInstitution("");
      setCourse("");
      setYear("");
      setRole("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (!youth) {
      toast.error("Select a youth first");
      return;
    }
    if (!institution) {
      toast.error("Select an institution");
      return;
    }
    onSubmit({
      cdmId: youth.cdm_id,
      fullName: youth.full_name,
      gender: "Female",
      phone: youth.phone ?? undefined,
      email: youth.email ?? undefined,
      deaneryName: youth.deanery_name || undefined,
      parishName: youth.parish_name || undefined,
      outstationName: youth.outstation_name || undefined,
      institution,
      course: course.trim() || undefined,
      yearOfStudy: year || undefined,
      leadershipRole: role.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            Add CUSA Member
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            Find by CDM No. or browse by location. Name, phone and parish are filled automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-3">Youth *</p>
            <YouthSearchInput value={youth} onChange={setYouth} org={org} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Institution *</span>
              <Select value={institution} onValueChange={setInstitution}>
                <SelectTrigger>
                  <SelectValue placeholder="Select institution" />
                </SelectTrigger>
                <SelectContent>
                  {CUSA_INSTITUTIONS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Year of Study</span>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"].map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Course</span>
              <Input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. Education"
              />
            </label>

            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Leadership role (optional)</span>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Chairperson"
              />
            </label>
          </div>
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
            {isPending ? "Saving…" : "Save Member"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
