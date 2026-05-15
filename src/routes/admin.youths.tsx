import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { MoreVertical, Pencil, Trash2, BadgeCheck, Download } from "lucide-react";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardBody, PageHeader, Pill } from "@/components/admin/ui-bits";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";
import {
  ColumnFilter,
  ColumnHeader,
  TableToolbar,
  applyColumnFilter,
  type ColumnFilterValue,
} from "@/components/admin/table-filters";
import { RecordFormDialog, type FieldDef } from "@/components/admin/record-form-dialog";
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
import { YOUTH_CATEGORIES, YOUTH_GENDERS } from "@/lib/youth-data";
import {
  bulkInsertYouths,
  createYouth,
  deleteYouth,
  listYouths,
  updateYouth,
  type YouthCategory,
  type YouthInput,
  type YouthRow,
} from "@/lib/db/youths";
import { createEnrollment } from "@/lib/db/enrollments";

const filterValueSchema = fallback(
  z
    .object({
      operator: z.enum(["equals", "contains", "startsWith", "notEquals"]),
      value: z.string(),
    })
    .optional(),
  undefined,
);

const youthSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  f_cdm: filterValueSchema,
  f_name: filterValueSchema,
  f_sex: filterValueSchema,
  f_deanery: filterValueSchema,
  f_parish: filterValueSchema,
  f_outstation: filterValueSchema,
  f_category: filterValueSchema,
  f_status: filterValueSchema,
});

type YouthSearch = z.infer<typeof youthSearchSchema>;

export const Route = createFileRoute("/admin/youths")({
  head: () => ({
    meta: [
      { title: "Youth Records — CDM Youth Office" },
      { name: "description", content: "Searchable directory of all youth registered in the Catholic Diocese of Murang'a." },
    ],
  }),
  validateSearch: zodValidator(youthSearchSchema),
  component: YouthsPage,
});

function YouthsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<null | { id: string; values: Record<string, string> }>(null);
  const [deleteTarget, setDeleteTarget] = useState<null | { id: string; name: string; cdmId: string }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<null | { inserted: number; skipped: number; total: number; firstCdms: string[] }>(null);
  const qc = useQueryClient();
  const { data: youths = [], isLoading } = useQuery({ queryKey: ["youths"], queryFn: listYouths });

  const rows = useMemo(
    () =>
      youths.map((y) => ({
        id: y.id,
        cdmId: y.cdm_id,
        name: y.full_name,
        gender: y.gender,
        age: y.age,
        phone: y.phone ?? "",
        altPhone: y.alt_phone ?? "",
        email: y.email ?? "",
        deaneryName: y.deanery?.name ?? "",
        parishName: y.parish?.name ?? "",
        churchName: y.outstation?.name ?? "",
        category: y.category,
        institution: y.institution ?? "",
        yearOfStudy: y.year_of_study ?? "",
        notes: y.notes ?? "",
        passportUrl: y.passport_url ?? "",
        status: y.status,
        enrolled: (y.enrollments?.length ?? 0) > 0,
        raw: y as YouthRow,
      })),
    [youths],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["youths"] });

  const createMut = useMutation({
    mutationFn: (input: YouthInput) => createYouth(input),
    onSuccess: (data: { cdm_id?: string } | unknown) => {
      const cdm = (data as { cdm_id?: string })?.cdm_id ?? "";
      toast.success(`Youth registered${cdm ? ` · ${cdm}` : ""}`);
      invalidate();
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: YouthInput }) => updateYouth(id, input),
    onSuccess: () => {
      toast.success("Youth updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteYouth(id),
    onSuccess: () => {
      toast.success("Youth deleted");
      invalidate();
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const enrollMut = useMutation({
    mutationFn: (cdmId: string) => createEnrollment({ cdmId }),
    onSuccess: () => {
      toast.success("Enrollment saved");
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setFilter = (patch: Partial<YouthSearch>) => {
    navigate({ search: (prev: YouthSearch) => ({ ...prev, ...patch }), replace: true });
  };
  const setDeaneryFilter = (v: ColumnFilterValue | undefined) => {
    navigate({
      search: (prev: YouthSearch) => ({ ...prev, f_deanery: v, f_parish: undefined, f_outstation: undefined }),
      replace: true,
    });
  };
  const setParishFilter = (v: ColumnFilterValue | undefined) => {
    navigate({
      search: (prev: YouthSearch) => ({ ...prev, f_parish: v, f_outstation: undefined }),
      replace: true,
    });
  };

  const filtered = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return rows.filter((row) => {
      if (!applyColumnFilter(row.cdmId, search.f_cdm)) return false;
      if (!applyColumnFilter(row.name, search.f_name)) return false;
      if (!applyColumnFilter(row.gender, search.f_sex)) return false;
      if (!applyColumnFilter(row.deaneryName, search.f_deanery)) return false;
      if (!applyColumnFilter(row.parishName, search.f_parish)) return false;
      if (!applyColumnFilter(row.churchName, search.f_outstation)) return false;
      if (!applyColumnFilter(row.category, search.f_category)) return false;
      if (!applyColumnFilter(row.status, search.f_status)) return false;
      if (q) {
        const haystack = [
          row.cdmId,
          row.name,
          row.parishName,
          row.deaneryName,
          row.churchName,
          row.institution,
          row.phone,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [search, rows]);

  const pagination = usePagination(filtered, 10);

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

  const youthFields: FieldDef[] = [
    { key: "fullName", label: "Full name", required: true, placeholder: "Grace Wanjiku" },
    { key: "gender", label: "Gender", type: "select", options: [...YOUTH_GENDERS], required: true },
    { key: "age", label: "Age", type: "number", placeholder: "16", required: true },
    { key: "phone", label: "Phone number", type: "tel", placeholder: "+254…", required: true },
    { key: "altPhone", label: "Alternative phone (optional)", type: "tel", placeholder: "+254…" },
    { key: "email", label: "Email (optional)", type: "email", placeholder: "name@example.com" },
    {
      key: "deanery", label: "Deanery", type: "select", required: true,
      options: ORGANIZATION.map((d) => d.name),
    },
    {
      key: "parish", label: "Parish", type: "select", required: true,
      dynamicOptions: (v) => ORGANIZATION.find((d) => d.name === v.deanery)?.parishes.map((p) => p.name) ?? [],
    },
    {
      key: "outstation", label: "Outstation / Local church", type: "select", required: true,
      dynamicOptions: (v) => {
        const d = ORGANIZATION.find((d) => d.name === v.deanery);
        const p = d?.parishes.find((p) => p.name === v.parish);
        return p?.churches.map((c) => c.name) ?? [];
      },
    },
    { key: "category", label: "Category", type: "select", options: [...YOUTH_CATEGORIES], required: true },
    { key: "institution", label: "Institution (if Tertiary)", placeholder: "e.g. Murang'a University" },
    { key: "yearOfStudy", label: "Year of study (if Tertiary)", placeholder: "e.g. Year 2" },
    { key: "notes", label: "Notes (optional)", type: "textarea", placeholder: "Anything worth recording" },
    { key: "passportUrl", label: "Passport photo (optional)", type: "image", full: true, bucket: "passports" },
  ];

  const SAMPLE_HEADERS = [
    "fullName","gender","age","phone","altPhone","email",
    "deanery","parish","outstation","category","institution","yearOfStudy","notes",
  ];
  const downloadSample = () => {
    const sampleRow = [
      "Grace Wanjiku","Female","16","+254700000000","","grace@example.com",
      "Murang’a Deanery","Cathedral","St. Mary Cathedral Outstation","Secondary","","","",
    ];
    const csv = [SAMPLE_HEADERS.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "youths-import-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Sample CSV downloaded");
  };
  const handleImportFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          const headers = (res.meta.fields ?? []).map((h) => h.trim());
          const required = ["fullName", "gender", "age", "phone", "deanery", "parish", "outstation", "category"];
          const aliases: Record<string, string[]> = { fullName: ["name"], phone: ["phoneNumber", "mobile"] };
          const missing = required.filter(
            (col) => !headers.includes(col) && !(aliases[col] ?? []).some((a) => headers.includes(a)),
          );
          if (missing.length) {
            toast.error(`CSV is missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`, {
              description: `Found columns: ${headers.join(", ") || "(none)"} — download the sample CSV for the expected header row.`,
            });
            return;
          }
          const known = new Set([
            ...required,
            ...Object.values(aliases).flat(),
            "altPhone", "email", "institution", "yearOfStudy", "notes",
          ]);
          const unknown = headers.filter((h) => !known.has(h));
          if (unknown.length) {
            toast.message(`Ignoring unknown columns: ${unknown.join(", ")}`, {
              description: "Recognised optional columns: altPhone, email, institution, yearOfStudy, notes.",
            });
          }
          const inputs: YouthInput[] = res.data
            .map((r) => ({
              fullName: (r.fullName || r.name || "").trim(),
              gender: ((r.gender || "Female").trim() as "Female" | "Male"),
              age: parseInt(r.age || "0", 10) || 0,
              phone: r.phone || null,
              altPhone: r.altPhone || null,
              email: r.email || null,
              deaneryName: r.deanery || null,
              parishName: r.parish || null,
              outstationName: r.outstation || null,
              category: ((r.category || "Secondary").trim() as YouthCategory),
              institution: r.institution || null,
              yearOfStudy: r.yearOfStudy || null,
              notes: r.notes || null,
            }))
            .filter((r) => r.fullName && r.age > 0);
          const total = res.data.length;
          if (!inputs.length) {
            toast.error("CSV has the right columns but no rows with a valid full name + age");
            return;
          }
          const inserted = await bulkInsertYouths(inputs);
          setImportResult({
            inserted: inserted.length,
            skipped: total - inputs.length,
            total,
            firstCdms: inserted.slice(0, 10).map((r) => (r as { cdm_id?: string }).cdm_id ?? ""),
          });
          invalidate();
          qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
          qc.invalidateQueries({ queryKey: ["live-analytics"] });
        } catch (e) {
          toast.error((e as Error).message);
        }
      },
      error: (err) => toast.error(err.message),
    });
  };

  const fc = (key: keyof YouthSearch, label: string, mode: "text" | "select" = "text", options?: { value: string; label: string }[]) => (
    <ColumnFilter
      label={label}
      mode={mode}
      options={options}
      value={search[key] as ColumnFilterValue | undefined}
      onChange={(v) => setFilter({ [key]: v } as Partial<YouthSearch>)}
    />
  );

  return (
    <>
      <Topbar title="Youth Records" />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Youth Directory"
          description={
            isLoading
              ? "Loading youths…"
              : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} youths · share this URL to share the same view.`
          }
        />

        <Card>
          <TableToolbar
            searchValue={search.q}
            onSearchChange={(value) => setFilter({ q: value })}
            searchPlaceholder="Search name, CDM No., parish, deanery, outstation, institution…"
            onImport={() => fileInputRef.current?.click()}
            onExport={() => toast.success(`Exporting ${filtered.length} youths`)}
            onAdd={() => setAddOpen(true)}
            addLabel="Register Youth"
            extra={
              <button
                type="button"
                onClick={downloadSample}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 transition hover:border-gold-3 hover:text-gold"
                title="Download CSV sample for import"
              >
                <Download className="h-3.5 w-3.5" /> Sample CSV
              </button>
            }
          />
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
          <CardBody className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="CDM No." filter={fc("f_cdm", "CDM No.")} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Name" filter={fc("f_name", "Name")} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Sex"
                      filter={fc("f_sex", "Sex", "select", YOUTH_GENDERS.map((g) => ({ value: g, label: g })))}
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Age</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
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
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
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
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Outstation" filter={fc("f_outstation", "Outstation", "select", outstationOptions)} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Category"
                      filter={fc("f_category", "Category", "select", YOUTH_CATEGORIES.map((c) => ({ value: c, label: c })))}
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Status"
                      filter={fc("f_status", "Status", "select", [
                        { value: "active", label: "Active" },
                        { value: "inactive", label: "Inactive" },
                      ])}
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                    <td className="px-3.5 py-2.5 font-mono text-[10px] font-bold text-gold">{row.cdmId}</td>
                    <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">{row.name}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row.gender === "Female" ? "F" : "M"}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row.age}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">{row.deaneryName}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row.parishName}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">{row.churchName}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row.category}</td>
                    <td className="px-3.5 py-2.5">
                      <Pill tone={row.status === "active" ? "success" : "neutral"}>{row.status}</Pill>
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
                          <DropdownMenuItem
                            onClick={() =>
                              setEditing({
                                id: row.id,
                                values: {
                                  fullName: row.name,
                                  gender: row.gender,
                                  age: String(row.age),
                                  phone: row.phone,
                                  altPhone: row.altPhone,
                                  email: row.email,
                                  deanery: row.deaneryName,
                                  parish: row.parishName,
                                  outstation: row.churchName,
                                  category: row.category,
                                  institution: row.institution,
                                  yearOfStudy: row.yearOfStudy,
                                  notes: row.notes,
                                  passportUrl: row.passportUrl,
                                },
                              })
                            }
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => enrollMut.mutate(row.cdmId)}
                          >
                            <BadgeCheck className="mr-2 h-3.5 w-3.5" /> Enroll
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-danger focus:text-danger"
                            onClick={() => setDeleteTarget({ id: row.id, name: row.name, cdmId: row.cdmId })}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {pagination.pageRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3.5 py-6 text-center text-[11px] text-text-3">
                      No youths match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
      <RecordFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Register Youth"
        description="A unique CDM No. is assigned automatically on save."
        fields={youthFields}
        submitLabel="Register Youth"
        onSubmit={(values) => createMut.mutate(toYouthInput(values))}
      />
      <RecordFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit Youth"
        description="All fields are editable. Unique CDM No. is permanent."
        fields={youthFields}
        initial={editing?.values}
        submitLabel="Save changes"
        onSubmit={(values) => {
          if (editing) updateMut.mutate({ id: editing.id, input: toYouthInput(values) });
          setEditing(null);
        }}
      />
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete youth record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.cdmId}) and any linked enrollment. This cannot be undone.
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={importResult !== null} onOpenChange={(o) => !o && setImportResult(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import results</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[12px] text-text-1">
                <div>
                  Saved <strong>{importResult?.inserted ?? 0}</strong> of {importResult?.total ?? 0} rows.
                  {importResult && importResult.skipped > 0 && (
                    <> {importResult.skipped} skipped (missing name or age).</>
                  )}
                </div>
                {importResult && importResult.firstCdms.length > 0 && (
                  <div>
                    <div className="font-semibold">First assigned CDM No(s):</div>
                    <div className="mt-1 max-h-40 overflow-y-auto rounded border border-border bg-bg-2 p-2 font-mono text-[10px]">
                      {importResult.firstCdms.filter(Boolean).join(", ")}
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setImportResult(null)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function toYouthInput(values: Record<string, string>): YouthInput {
  return {
    fullName: values.fullName?.trim() ?? "",
    gender: (values.gender as "Female" | "Male") || "Female",
    age: parseInt(values.age || "0", 10) || 0,
    phone: values.phone || null,
    altPhone: values.altPhone || null,
    email: values.email || null,
    deaneryName: values.deanery || null,
    parishName: values.parish || null,
    outstationName: values.outstation || null,
    category: (values.category as YouthCategory) || "Secondary",
    institution: values.institution || null,
    yearOfStudy: values.yearOfStudy || null,
    notes: values.notes || null,
    passportUrl: values.passportUrl || null,
  };
}
