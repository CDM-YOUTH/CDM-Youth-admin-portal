import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { MoreVertical, Pencil, Trash2, BadgeCheck, Download, Plus } from "lucide-react";
import { downloadXlsx } from "@/lib/export-xlsx";
import { fetchOrg } from "@/lib/db/org";
import { useAdminScope } from "@/lib/hooks/use-admin-scope";
import { CUSA_INSTITUTIONS } from "@/lib/cusa-data";
import { type PagedResponse } from "@/lib/api/fetch-api";
import { Topbar } from "@/components/admin/layout/topbar";
import { Card, CardBody, Pill } from "@/components/admin/composables/ui-bits";
import { TablePagination } from "@/components/admin/composables/tables/table-pagination";
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
  listYouthsPaged,
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
  // Server-side params
  q: fallback(z.string(), "").default(""),
  deanery_id: fallback(z.string(), "").default(""),
  parish_id: fallback(z.string(), "").default(""),
  outstation_id: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
  page: fallback(z.number().int().min(1), 1).default(1),
  size: fallback(z.number().int().min(1).max(100), 25).default(25),
  // Client-side column filters (applied on current page rows only)
  f_cdm: filterValueSchema,
  f_name: filterValueSchema,
  f_sex: filterValueSchema,
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

  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const scope = useAdminScope();

  // Scope takes precedence over URL params — scoped users can't widen their view
  const deaneryId = scope.deaneryId || search.deanery_id;
  const parishId  = scope.parishId  || search.parish_id;

  const { data: resp, isLoading } = useQuery({
    queryKey: [
      "youths",
      search.page - 1,
      search.size,
      search.q,
      deaneryId,
      parishId,
      search.outstation_id,
      search.category,
      search.status,
    ],
    queryFn: () =>
      listYouthsPaged({
        page: search.page - 1,
        size: search.size,
        q: search.q,
        deaneryId: deaneryId || null,
        parishId:  parishId  || null,
        outstationId: search.outstation_id || null,
        category: search.category || null,
        status: search.status || null,
      }),
    placeholderData: keepPreviousData,
  });

  const total = resp?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / search.size));

  const rows = useMemo(
    () =>
      (resp?.data ?? []).map((y) => ({
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
    [resp],
  );

  // Client-side column filters applied on the current page only
  const displayRows = useMemo(() => {
    if (!search.f_cdm && !search.f_name && !search.f_sex) return rows;
    return rows.filter((row) => {
      if (!applyColumnFilter(row.cdmId, search.f_cdm)) return false;
      if (!applyColumnFilter(row.name, search.f_name)) return false;
      if (!applyColumnFilter(row.gender, search.f_sex)) return false;
      return true;
    });
  }, [rows, search.f_cdm, search.f_name, search.f_sex]);

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
    navigate({ search: (prev: YouthSearch) => ({ ...prev, ...patch, page: 1 }), replace: true });
  };

  // Org dropdowns use UUIDs as values (from live Supabase org tree)
  const deaneryOptions = (org?.deaneries ?? []).map((d) => ({ value: d.id, label: d.name }));
  const parishOptions = (org?.parishes ?? [])
    .filter((p) => !deaneryId || p.deanery_id === deaneryId)
    .map((p) => ({ value: p.id, label: p.name }));
  const outstationOptions = (org?.outstations ?? [])
    .filter((o) => !parishId || o.parish_id === parishId)
    .map((o) => ({ value: o.id, label: o.name }));

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
        description={isLoading ? "Loading youths…" : `${total.toLocaleString()} youth${total !== 1 ? "s" : ""} · share this URL to share the same view.`}
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
            onExport={async () => {
              try {
                const all = await listYouthsPaged({
                  page: 0, size: 2000,
                  q: search.q,
                  deaneryId: search.deanery_id || null,
                  parishId: search.parish_id || null,
                  outstationId: search.outstation_id || null,
                  category: search.category || null,
                  status: search.status || null,
                });
                const headers = ["CDM No.", "Full Name", "Gender", "Age", "Phone", "Alt Phone", "Email", "Deanery", "Parish", "Outstation", "Category", "Institution", "Year of Study", "Status"];
                const data: (string | number | null)[][] = (all.data ?? []).map((y) => [y.cdm_id, y.full_name, y.gender ?? null, y.age ?? null, y.phone ?? null, y.alt_phone ?? null, y.email ?? null, y.deanery?.name ?? null, y.parish?.name ?? null, y.outstation?.name ?? null, y.category ?? null, y.institution ?? null, y.year_of_study ?? null, y.status ?? null]);
                await downloadXlsx("youths-export", "Youth Records", headers, data);
                toast.success(`Exported ${all.total} youths`);
              } catch (e) {
                toast.error((e as Error).message);
              }
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
                          value={deaneryId ? { operator: "equals", value: deaneryId } : undefined}
                          onChange={(v) => setFilter({ deanery_id: v?.value ?? "", parish_id: "", outstation_id: "" })}
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
                          value={search.outstation_id ? { operator: "equals", value: search.outstation_id } : undefined}
                          onChange={(v) => setFilter({ outstation_id: v?.value ?? "" })}
                        />
                      }
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Category"
                      filter={
                        <ColumnFilter
                          label="Category"
                          mode="select"
                          options={YOUTH_CATEGORIES.map((c) => ({ value: c, label: c }))}
                          value={search.category ? { operator: "equals", value: search.category } : undefined}
                          onChange={(v) => setFilter({ category: v?.value ?? "" })}
                        />
                      }
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Status"
                      filter={
                        <ColumnFilter
                          label="Status"
                          mode="select"
                          options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
                          value={search.status ? { operator: "equals", value: search.status } : undefined}
                          onChange={(v) => setFilter({ status: v?.value ?? "" })}
                        />
                      }
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
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
                {displayRows.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={10} className="px-3.5 py-6 text-center text-[11px] text-text-3">
                      No youths match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePagination
              page={search.page}
              pageSize={search.size}
              total={total}
              totalPages={totalPages}
              onPageChange={(p) => navigate({ search: (prev: YouthSearch) => ({ ...prev, page: p }), replace: true })}
              onPageSizeChange={(s) => navigate({ search: (prev: YouthSearch) => ({ ...prev, size: s, page: 1 }), replace: true })}
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
