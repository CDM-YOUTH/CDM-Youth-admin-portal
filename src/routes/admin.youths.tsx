import { useMemo, useRef, useState } from "react";
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
import { YOUTH_CATEGORIES, YOUTH_GENDERS, YOUTH_REGISTRY } from "@/lib/youth-data";

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
  const [editing, setEditing] = useState<null | Record<string, string>>(null);
  const [deleteTarget, setDeleteTarget] = useState<null | { name: string; cdmId: string }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    return YOUTH_REGISTRY.filter((row) => {
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
          row.institution ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [search]);

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

  const nextCdmId = useMemo(() => {
    const max = YOUTH_REGISTRY.reduce((m, r) => {
      const n = parseInt(r.cdmId.split("-").pop() ?? "0", 10);
      return n > m ? n : m;
    }, 0);
    return `CDM-2026-${String(max + 1).padStart(5, "0")}`;
  }, []);

  const youthFields: FieldDef[] = [
    { key: "cdmId", label: "Unique CDM No. (auto-generated)", placeholder: nextCdmId },
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
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.trim().split(/\r?\n/);
      const rows = Math.max(0, lines.length - 1);
      toast.success(`Imported ${rows} youth record${rows === 1 ? "" : "s"} (CDM No. auto-assigned)`);
    };
    reader.readAsText(file);
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
          description={`${filtered.length.toLocaleString()} of ${YOUTH_REGISTRY.length.toLocaleString()} youths · share this URL to share the same view.`}
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
                                cdmId: row.cdmId,
                                fullName: row.name,
                                gender: row.gender,
                                age: String(row.age),
                                phone: "",
                                altPhone: "",
                                email: "",
                                deanery: row.deaneryName,
                                parish: row.parishName,
                                outstation: row.churchName,
                                category: row.category,
                                institution: row.institution ?? "",
                                yearOfStudy: "",
                                notes: "",
                              })
                            }
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toast.success(`Enrollment started for ${row.name} · ${row.cdmId}`)
                            }
                          >
                            <BadgeCheck className="mr-2 h-3.5 w-3.5" /> Enroll
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-danger focus:text-danger"
                            onClick={() => setDeleteTarget({ name: row.name, cdmId: row.cdmId })}
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
        description={`Auto-assigned Unique No.: ${nextCdmId}`}
        fields={youthFields}
        submitLabel="Register Youth"
        onSubmit={(values) => {
          toast.success(`${values.fullName} registered · ${nextCdmId}`);
        }}
      />
      <RecordFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={`Edit Youth · ${editing?.cdmId ?? ""}`}
        description="All fields are editable. Unique CDM No. is permanent."
        fields={youthFields}
        initial={editing ?? undefined}
        submitLabel="Save changes"
        onSubmit={(values) => {
          toast.success(`${values.fullName} updated`);
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
                toast.success(`${deleteTarget?.name} deleted`);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
