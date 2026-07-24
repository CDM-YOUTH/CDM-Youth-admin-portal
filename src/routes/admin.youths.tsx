import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { MoreVertical, Pencil, Trash2, BadgeCheck, Download, Plus } from "lucide-react";
import { downloadXlsx } from "@/lib/export-xlsx";
import { fetchOrg } from "@/lib/db/org";
import { CUSA_INSTITUTIONS } from "@/lib/cusa-data";
import { Topbar } from "@/components/admin/layout/topbar";
import { Card, CardBody, Pill } from "@/components/admin/composables/ui-bits";
import { TablePagination, usePagination } from "@/components/admin/composables/tables/table-pagination";
import {
  ColumnFilter,
  ColumnHeader,
  TableToolbar,
  applyColumnFilter,
  type ColumnFilterValue,
} from "@/components/admin/composables/tables/table-filters";
import { RecordFormDialog, type FieldDef } from "@/components/admin/composables/forms/record-form-dialog";
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
} from "@/lib/db/youth-records/youths";
import { createEnrollment } from "@/lib/db/youth-records/enrollments";

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
  const [enrollTarget, setEnrollTarget] = useState<null | { cdmId: string; name: string }>(null);
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
    mutationFn: ({ cdmId, paymentRef }: { cdmId: string; paymentRef?: string }) =>
      createEnrollment({ cdmId, paymentRef: paymentRef || null }),
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

  const enrollFields: FieldDef[] = [
    { key: "cdmId", label: "CDM No.", required: true, placeholder: "CDM-2026-00001" },
    { key: "fullName", label: "Full Name", placeholder: "Youth name" },
    { key: "paymentRef", label: "Payment reference (optional)", placeholder: "Bank slip / transaction ref" },
  ];

  const SAMPLE_HEADERS = [
    "FULL NAME","GENDER","AGE","PHONE","ALT PHONE","EMAIL",
    "DEANERY","PARISH","OUTSTATION","CATEGORY","INSTITUTION","YEAR OF STUDY","NOTES",
  ];
  const downloadSample = async () => {
    const sampleRows: (string | number | null)[][] = [
      ["Grace Wanjiku","Female","16","+254700000000","","grace@example.com","Murang’a Deanery","Cathedral","St. Mary Cathedral Outstation","Secondary","","",""],
      ["Peter Mwangi","Male","20","+254711000000","","","Mwea Deanery","Mwea","Holy Family Mwea Outstation","Tertiary","Murang’a University","Year 2",""],
    ];
    try {
      const org = await fetchOrg();
      const deaneryNames = org.deaneries.map((d) => d.name);
      const parishByDeanery: Record<string, string[]> = {};
      for (const [deaneryName, parishes] of org.parishesByDeaneryName) {
        parishByDeanery[deaneryName] = parishes.map((p) => p.name);
      }
      const outstationByParish: Record<string, string[]> = {};
      for (const [parishName, outstations] of org.outstationsByParishName) {
        outstationByParish[parishName] = outstations.map((o) => o.name);
      }
      await downloadXlsx("youths-import-sample", "Youth Import Sample", SAMPLE_HEADERS, sampleRows, {
        flat: {
          "GENDER": ["Female", "Male"],
          "DEANERY": deaneryNames,
          "CATEGORY": ["Primary", "Secondary", "Tertiary", "Working"],
          "INSTITUTION": [...CUSA_INSTITUTIONS],
          "YEAR OF STUDY": ["Year 1", "Year 2", "Year 3", "Year 4", "Postgraduate", "Alumni"],
        },
        cascade: {
          "PARISH": { parent: "DEANERY", map: parishByDeanery },
          "OUTSTATION": { parent: "PARISH", map: outstationByParish },
        },
      }, { headerTextColor: "FFAAAA" });
      toast.success("Import sample downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const handleImportFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          const rawFields = res.meta.fields ?? [];
          // Normalize: lowercase, strip spaces/underscores/dots for flexible matching
          const nk = (h: string) => h.trim().toLowerCase().replace(/[\s_.-]+/g, "");
          const fieldMap: Record<string, string> = {};
          rawFields.forEach(h => { fieldMap[nk(h)] = h; });
          const normHeaders = rawFields.map(nk);
          const get = (r: Record<string, string>, ...keys: string[]) =>
            keys.map(k => r[fieldMap[nk(k)]] ?? "").find(v => v) ?? "";

          const required = ["fullname", "gender", "age", "phone", "deanery", "parish", "outstation", "category"];
          const aliases: Record<string, string[]> = { fullname: ["name"], phone: ["phonenumber", "mobile"] };
          const missing = required.filter(
            (col) => !normHeaders.includes(col) && !(aliases[col] ?? []).some((a) => normHeaders.includes(a)),
          );
          if (missing.length) {
            toast.error(`CSV is missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`, {
              description: `Found columns: ${rawFields.join(", ") || "(none)"} — download the sample for the expected header row.`,
            });
            return;
          }
          const known = new Set(["fullname", "name", "gender", "age", "phone", "phonenumber", "mobile", "altphone", "email", "deanery", "parish", "outstation", "category", "institution", "yearofstudy", "notes"]);
          const unknown = rawFields.filter((h) => !known.has(nk(h)));
          if (unknown.length) {
            toast.message(`Ignoring unknown columns: ${unknown.join(", ")}`, {
              description: "Recognised optional columns: alt phone, email, institution, year of study, notes.",
            });
          }
          const inputs: YouthInput[] = res.data
            .map((r) => ({
              fullName: get(r, "FULL NAME", "fullName", "name").trim(),
              gender: ((get(r, "gender") || "Female").trim() as "Female" | "Male"),
              age: parseInt(get(r, "age") || "0", 10) || 0,
              phone: get(r, "phone") || null,
              altPhone: get(r, "ALT PHONE", "altPhone") || null,
              email: get(r, "email") || null,
              deaneryName: get(r, "deanery") || null,
              parishName: get(r, "parish") || null,
              outstationName: get(r, "outstation") || null,
              category: ((get(r, "category") || "Secondary").trim() as YouthCategory),
              institution: get(r, "institution") || null,
              yearOfStudy: get(r, "YEAR OF STUDY", "yearOfStudy") || null,
              notes: get(r, "notes") || null,
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
      <Topbar
        title="Youth Directory"
        description={isLoading ? "Loading youths…" : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} youths · share this URL to share the same view.`}
        action={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[11px] font-bold text-white transition hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Register Youth
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          <TableToolbar
            searchValue={search.q}
            onSearchChange={(value) => setFilter({ q: value })}
            searchPlaceholder="Search name, CDM No., parish, deanery, outstation, institution…"
            onImport={() => fileInputRef.current?.click()}
            onExport={() => {
              const headers = ["CDM No.", "Full Name", "Gender", "Age", "Phone", "Alt Phone", "Email", "Deanery", "Parish", "Outstation", "Category", "Institution", "Year of Study", "Status"];
              const data: (string | number | null)[][] = filtered.map((r) => [r.cdmId, r.name, r.gender, r.age, r.phone, r.altPhone, r.email, r.deaneryName, r.parishName, r.churchName, r.category, r.institution, r.yearOfStudy, r.status]);
              downloadXlsx("youths-export", "Youth Records", headers, data).then(() => toast.success(`Exported ${filtered.length} youths`)).catch((e: Error) => toast.error(e.message));
            }}
            extra={
              <button
                type="button"
                onClick={downloadSample}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-2.5 text-[11px] font-bold text-white transition hover:opacity-90"
                title="Download Excel import sample"
              >
                <Download className="h-3.5 w-3.5" /> Import Sample
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
                            onClick={() => setEnrollTarget({ cdmId: row.cdmId, name: row.name })}
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
      <RecordFormDialog
        open={enrollTarget !== null}
        onOpenChange={(o) => !o && setEnrollTarget(null)}
        title="Confirm Enrollment · 2026"
        description="Review details and add a payment reference before confirming enrollment."
        fields={enrollFields}
        initial={enrollTarget ? { cdmId: enrollTarget.cdmId, fullName: enrollTarget.name } : undefined}
        submitLabel="Confirm Enrollment"
        onSubmit={(values) => {
          enrollMut.mutate({ cdmId: values.cdmId.trim(), paymentRef: values.paymentRef });
          setEnrollTarget(null);
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
