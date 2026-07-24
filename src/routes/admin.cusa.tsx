import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Pencil, Trash2, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { Topbar } from "@/components/admin/layout/topbar";
import { Card, CardBody, Pill } from "@/components/admin/composables/ui-bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CUSA_INSTITUTIONS } from "@/lib/cusa-data";
import { ORGANIZATION } from "@/lib/mock-data";
import { createCusaMember, deleteCusaMember, listCusa, updateCusaMember } from "@/lib/db/youth-records/cusa";
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
import { TablePagination, usePagination } from "@/components/admin/composables/tables/table-pagination";
import {
  ColumnFilter,
  ColumnHeader,
  TableToolbar,
  applyColumnFilter,
  type ColumnFilterValue,
} from "@/components/admin/composables/tables/table-filters";
import { RecordFormDialog } from "@/components/admin/composables/forms/record-form-dialog";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  q: fallback(z.string(), "").default(""),
  f_cdm: filterValueSchema,
  f_name: filterValueSchema,
  f_institution: filterValueSchema,
  f_deanery: filterValueSchema,
  f_parish: filterValueSchema,
  f_outstation: filterValueSchema,
  f_gender: filterValueSchema,
  f_status: filterValueSchema,
});

type CusaSearch = z.infer<typeof cusaSearchSchema>;

export const Route = createFileRoute("/admin/cusa")({
  head: () => ({
    meta: [
      { title: "CUSA — CDM Youth Office" },
      { name: "description", content: "Colleges and Universities Students Association: chapters, members, and events." },
    ],
  }),
  validateSearch: zodValidator(cusaSearchSchema),
  component: CusaPage,
});

function CusaPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<null | { id: string; name: string; values: Record<string, string> }>(null);
  const [deleteTarget, setDeleteTarget] = useState<null | { id: string; name: string }>(null);
  const qc = useQueryClient();
  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const { data: cusa = [], isLoading } = useQuery({ queryKey: ["cusa"], queryFn: () => listCusa() });
  const createMut = useMutation({
    mutationFn: (vals: {
      cdmId?: string | null; fullName: string; gender: "Female" | "Male";
      age?: number; phone?: string; email?: string;
      deaneryName?: string; parishName?: string; outstationName?: string;
      institution: string; course?: string; yearOfStudy?: string; leadershipRole?: string;
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
    navigate({ search: (prev: CusaSearch) => ({ ...prev, ...patch }), replace: true });
  };
  const setDeaneryFilter = (v: ColumnFilterValue | undefined) => {
    // changing deanery clears parish + outstation
    navigate({
      search: (prev: CusaSearch) => ({ ...prev, f_deanery: v, f_parish: undefined, f_outstation: undefined }),
      replace: true,
    });
  };
  const setParishFilter = (v: ColumnFilterValue | undefined) => {
    navigate({
      search: (prev: CusaSearch) => ({ ...prev, f_parish: v, f_outstation: undefined }),
      replace: true,
    });
  };

  const allMembers = useMemo(
    () =>
      cusa.map((m) => ({
        id: m.id,
        cdmId: m.youth?.cdm_id ?? "",
        name: m.youth?.full_name ?? "",
        gender: m.youth?.gender ?? "",
        institution: m.institution,
        course: m.course ?? "",
        year: m.year_of_study ?? "",
        deaneryName: m.youth?.deanery?.name ?? "",
        parishName: m.youth?.parish?.name ?? "",
        churchName: "",
        status: m.leadership_role ? "active" : "reporting",
      })),
    [cusa],
  );

  const filteredMembers = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return allMembers.filter((member) => {
      if (!applyColumnFilter(member.cdmId, search.f_cdm)) return false;
      if (!applyColumnFilter(member.name, search.f_name)) return false;
      if (!applyColumnFilter(member.institution, search.f_institution)) return false;
      if (!applyColumnFilter(member.deaneryName, search.f_deanery)) return false;
      if (!applyColumnFilter(member.parishName, search.f_parish)) return false;
      if (!applyColumnFilter(member.churchName, search.f_outstation)) return false;
      if (!applyColumnFilter(member.gender, search.f_gender)) return false;
      if (!applyColumnFilter(member.status, search.f_status)) return false;
      if (q) {
        const haystack = [
          member.cdmId,
          member.name,
          member.institution,
          member.deaneryName,
          member.parishName,
          member.churchName,
          member.course,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allMembers, search]);

  const pagination = usePagination(filteredMembers, 15);

  const deaneryOptions = ORGANIZATION.map((d) => ({ value: d.name, label: d.name }));
  const selectedDeaneryName =
    search.f_deanery?.operator === "equals" ? search.f_deanery.value : "";
  const selectedParishName =
    search.f_parish?.operator === "equals" ? search.f_parish.value : "";
  const parishScope = selectedDeaneryName
    ? ORGANIZATION.find((d) => d.name === selectedDeaneryName)?.parishes ?? []
    : ORGANIZATION.flatMap((d) => d.parishes);
  const parishOptions = Array.from(new Set(parishScope.map((p) => p.name))).map((name) => ({
    value: name,
    label: name,
  }));
  const outstationScope = selectedParishName
    ? parishScope.filter((p) => p.name === selectedParishName)
    : parishScope;
  const outstationOptions = Array.from(
    new Set(outstationScope.flatMap((p) => p.churches.map((c) => c.name))),
  ).map((name) => ({ value: name, label: name }));

const fc = (key: keyof CusaSearch, label: string, mode: "text" | "select" = "text", options?: { value: string; label: string }[]) => (
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
        title="Colleges & Universities Students Association (CUSA)"
        description={isLoading ? "Loading CUSA members…" : `${filteredMembers.length.toLocaleString()} of ${allMembers.length.toLocaleString()} members shown — share this URL to share the same view.`}
        action={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[11px] font-bold text-white transition hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Member
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          <TableToolbar
            searchValue={search.q}
            onSearchChange={(value) => setFilter({ q: value })}
            searchPlaceholder="Search name, CDM No., institution, parish…"
            onImport={() => toast.info("Import CUSA members — bring CSV soon")}
            onExport={() => toast.success(`Exporting ${filteredMembers.length} CUSA members`)}
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
                      filter={fc("f_institution", "Institution", "select", CUSA_INSTITUTIONS.map((i) => ({ value: i, label: i })))}
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
                          value={search.f_deanery}
                          onChange={setDeaneryFilter}
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
                          value={search.f_parish}
                          onChange={setParishFilter}
                        />
                      }
                    />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader label="Outstation" filter={fc("f_outstation", "Outstation", "select", outstationOptions)} />
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
                {pagination.pageRows.map((member) => (
                  <TableRow key={member.id} className="border-border/30 hover:bg-bg-3">
                    <TableCell className="px-3 py-2 font-mono text-[10px] font-bold text-violet">{member.cdmId}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] font-semibold text-foreground">{member.name}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-1">{member.institution}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">{member.deaneryName}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">{member.parishName}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">{member.churchName}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">{member.gender}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">{member.course} · {member.year}</TableCell>
                    <TableCell className="px-3 py-2"><Pill tone={member.status === "active" ? "success" : "violet"}>{member.status}</Pill></TableCell>
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
                {pagination.pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="px-3 py-6 text-center text-[11px] text-text-3">
                      No CUSA members match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
          { key: "institution", label: "Institution", type: "select", options: [...CUSA_INSTITUTIONS], required: true },
          { key: "course", label: "Course", placeholder: "e.g. Education" },
          { key: "year", label: "Year of study", type: "select", options: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"] },
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
              This removes the CUSA membership for <strong>{deleteTarget?.name}</strong>. The youth record itself is not deleted.
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
    cdmId?: string | null; fullName: string; gender: "Female" | "Male";
    age?: number; phone?: string; email?: string;
    deaneryName?: string; parishName?: string; outstationName?: string;
    institution: string; course?: string; yearOfStudy?: string; leadershipRole?: string;
  }) => void;
}) {
  const [youth,       setYouth]       = useState<PickedYouth | null>(null);
  const [institution, setInstitution] = useState("");
  const [course,      setCourse]      = useState("");
  const [year,        setYear]        = useState("");
  const [role,        setRole]        = useState("");

  useEffect(() => {
    if (open) {
      setYouth(null); setInstitution(""); setCourse(""); setYear(""); setRole("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (!youth)        { toast.error("Select a youth first"); return; }
    if (!institution)  { toast.error("Select an institution"); return; }
    onSubmit({
      cdmId:         youth.cdm_id,
      fullName:      youth.full_name,
      gender:        "Female",
      phone:         youth.phone    ?? undefined,
      email:         youth.email    ?? undefined,
      deaneryName:   youth.deanery_name   || undefined,
      parishName:    youth.parish_name    || undefined,
      outstationName: youth.outstation_name || undefined,
      institution,
      course:        course.trim()  || undefined,
      yearOfStudy:   year           || undefined,
      leadershipRole: role.trim()   || undefined,
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
                <SelectTrigger><SelectValue placeholder="Select institution" /></SelectTrigger>
                <SelectContent>
                  {CUSA_INSTITUTIONS.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
              <span>Year of Study</span>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"].map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
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
