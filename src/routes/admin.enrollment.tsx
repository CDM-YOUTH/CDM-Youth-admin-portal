import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { Download, MoreVertical, Trash2, BadgeCheck, Clock } from "lucide-react";
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
import { ORGANIZATION } from "@/lib/mock-data";
import { YOUTH_CATEGORIES } from "@/lib/youth-data";
import {
  bulkEnrollRows,
  createEnrollment,
  deleteEnrollment,
  listEnrollments,
  updateEnrollmentStatus,
  type BulkEnrollRow,
} from "@/lib/db/enrollments";
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

const filterValueSchema = fallback(
  z
    .object({
      operator: z.enum(["equals", "contains", "startsWith", "notEquals"]),
      value: z.string(),
    })
    .optional(),
  undefined,
);

const enrollmentSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  f_cdm: filterValueSchema,
  f_name: filterValueSchema,
  f_deanery: filterValueSchema,
  f_parish: filterValueSchema,
  f_category: filterValueSchema,
  f_payment: filterValueSchema,
});

type EnrollmentSearch = z.infer<typeof enrollmentSearchSchema>;

const FEE_BY_CATEGORY: Record<string, string> = {
  Primary: "KES 300",
  Secondary: "KES 500",
  Tertiary: "KES 800",
  Working: "KES 1,000",
};

export const Route = createFileRoute("/admin/enrollment")({
  head: () => ({
    meta: [
      { title: "Enrollment — CDM Youth Office" },
      {
        name: "description",
        content: "Annual youth enrollment with online payment tracking and parish-level approval queue.",
      },
    ],
  }),
  validateSearch: zodValidator(enrollmentSearchSchema),
  component: EnrollmentPage,
});

function EnrollmentPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFileName, setPendingFileName] = useState<string>("");
  const [pendingRows, setPendingRows] = useState<BulkEnrollRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<null | { id: string; name: string }>(null);
  const qc = useQueryClient();
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => listEnrollments(),
  });

  const createMut = useMutation({
    mutationFn: (vals: { cdmId: string; paymentRef?: string }) =>
      createEnrollment({ cdmId: vals.cdmId, paymentRef: vals.paymentRef || null }),
    onSuccess: () => {
      toast.success("Enrollment saved");
      qc.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const bulkMut = useMutation({
    mutationFn: ({ rows, ref }: { rows: BulkEnrollRow[]; ref: string | null }) =>
      bulkEnrollRows(rows, ref),
    onSuccess: (res) => {
      toast.success(`Enrolled ${res.inserted} youths${res.missing.length ? ` · ${res.missing.length} missing` : ""}`);
      if (res.missing.length) toast.message("Missing CDM IDs", { description: res.missing.slice(0, 5).join(", ") });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEnrollment(id),
    onSuccess: () => {
      toast.success("Enrollment removed");
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "paid" | "pending" }) =>
      updateEnrollmentStatus(id, status),
    onSuccess: () => {
      toast.success("Payment status updated");
      qc.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const setFilter = (patch: Partial<EnrollmentSearch>) => {
    navigate({ search: (prev: EnrollmentSearch) => ({ ...prev, ...patch }), replace: true });
  };
  const setDeaneryFilter = (v: ColumnFilterValue | undefined) => {
    navigate({
      search: (prev: EnrollmentSearch) => ({ ...prev, f_deanery: v, f_parish: undefined }),
      replace: true,
    });
  };

  const enrollmentRows = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return enrollments
      .map((e) => ({
        id: e.id,
        cdmId: e.youth?.cdm_id ?? "",
        name: e.youth?.full_name ?? "",
        deaneryName: e.youth?.deanery?.name ?? "",
        parishName: e.youth?.parish?.name ?? "",
        category: e.youth?.category ?? "",
        fee: FEE_BY_CATEGORY[e.youth?.category ?? ""] ?? "KES 500",
        paymentStatus: e.status === "paid" ? "approved" : "pending",
      }))
      .filter((row) => {
        if (!applyColumnFilter(row.cdmId, search.f_cdm)) return false;
        if (!applyColumnFilter(row.name, search.f_name)) return false;
        if (!applyColumnFilter(row.deaneryName, search.f_deanery)) return false;
        if (!applyColumnFilter(row.parishName, search.f_parish)) return false;
        if (!applyColumnFilter(row.category, search.f_category)) return false;
        if (!applyColumnFilter(row.paymentStatus, search.f_payment)) return false;
        if (q) {
          const haystack = [row.cdmId, row.name, row.parishName, row.deaneryName].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
  }, [search, enrollments]);

  const pagination = usePagination(enrollmentRows, 10);

  const deaneryOptions = ORGANIZATION.map((d) => ({ value: d.name, label: d.name }));
  const selectedDeaneryName =
    search.f_deanery?.operator === "equals" ? search.f_deanery.value : "";
  const parishScope = selectedDeaneryName
    ? ORGANIZATION.find((d) => d.name === selectedDeaneryName)?.parishes ?? []
    : ORGANIZATION.flatMap((d) => d.parishes);
  const parishOptions = Array.from(new Set(parishScope.map((p) => p.name))).map((name) => ({
    value: name,
    label: name,
  }));

  const enrollFields: FieldDef[] = [
    { key: "cdmId", label: "CDM No.", required: true, placeholder: "CDM-2026-00001" },
    { key: "fullName", label: "Name (auto-filled from CDM No.)", required: true, placeholder: "Youth name" },
    { key: "paymentRef", label: "Payment reference (optional)", placeholder: "Bank slip / transaction ref" },
  ];

  const importFields: FieldDef[] = [
    {
      key: "payerType", label: "Who paid?", type: "select", required: true,
      options: ["Individual youths (each pays own)", "Single bulk payer (parish/outstation leader)"],
    },
    { key: "payerName", label: "Bulk payer name (if any)", placeholder: "e.g. John Mwangi (Cathedral Parish leader)" },
    {
      key: "payerRole", label: "Payer role (if any)", type: "select",
      options: ["Parish leader", "Outstation leader", "Deanery leader", "Other"],
    },
    { key: "paymentRef", label: "Bulk payment reference", placeholder: "Bank slip number" },
    { key: "amount", label: "Total amount paid (KES)", type: "number", placeholder: "e.g. 50000" },
    {
      key: "deanery", label: "Bulk payer deanery", type: "select",
      options: ORGANIZATION.map((d) => d.name),
    },
    {
      key: "parish", label: "Bulk payer parish", type: "select",
      dynamicOptions: (v) => ORGANIZATION.find((d) => d.name === v.deanery)?.parishes.map((p) => p.name) ?? [],
    },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Anything about this batch" },
  ];

  const SAMPLE_HEADERS = ["cdmId", "fullName", "paymentRef"];
  const downloadSample = () => {
    const rows = [
      SAMPLE_HEADERS.join(","),
      "CDM-2026-00001,Grace Wanjiku,BANK-2026-001",
      "CDM-2026-00002,Peter Mwangi,BANK-2026-001",
      "CDM-2026-00003,Mary Njeri,",
    ];
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "enrollment-import-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Sample CSV downloaded");
  };
  const onPickFile = () => fileInputRef.current?.click();
  const handleImportFile = (file: File) => {
    setPendingFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows: BulkEnrollRow[] = res.data
          .map((r) => ({
            cdmId: (r.cdmId || r.cdm_id || "").trim(),
            paymentRef: (r.paymentRef || r.payment_ref || "").trim() || null,
          }))
          .filter((r) => r.cdmId);
        if (!rows.length) {
          toast.error("No CDM IDs found in CSV");
          return;
        }
        setPendingRows(rows);
        setImportOpen(true);
      },
      error: (err: Error) => toast.error(err.message),
    });
  };

  const fc = (key: keyof EnrollmentSearch, label: string, mode: "text" | "select" = "text", options?: { value: string; label: string }[]) => (
    <ColumnFilter
      label={label}
      mode={mode}
      options={options}
      value={search[key] as ColumnFilterValue | undefined}
      onChange={(v) => setFilter({ [key]: v } as Partial<EnrollmentSearch>)}
    />
  );

  return (
    <>
      <Topbar title="Enrollment" />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Annual Enrollment 2026"
          description={
            isLoading
              ? "Loading enrollments…"
              : `${enrollmentRows.length.toLocaleString()} matching enrollments. A youth must be registered (CDM No.) before being enrolled.`
          }
        />

        <Card>
          <TableToolbar
            searchValue={search.q}
            onSearchChange={(value) => setFilter({ q: value })}
            searchPlaceholder="Search name, CDM No., parish, deanery, outstation…"
            onImport={onPickFile}
            onExport={() => toast.success(`Exporting ${enrollmentRows.length} enrollments`)}
            onAdd={() => setAddOpen(true)}
            addLabel="Enroll Youth"
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
                    <ColumnHeader label="Parish" filter={fc("f_parish", "Parish", "select", parishOptions)} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Category"
                      filter={fc("f_category", "Category", "select", YOUTH_CATEGORIES.map((c) => ({ value: c, label: c })))}
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">Fee</th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Payment"
                      filter={fc("f_payment", "Payment", "select", [
                        { value: "approved", label: "Approved" },
                        { value: "pending", label: "Pending" },
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
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">{row.deaneryName}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row.parishName}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row.category}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row.fee}</td>
                    <td className="px-3.5 py-2.5">
                      <Pill tone={row.paymentStatus === "approved" ? "success" : "gold"}>{row.paymentStatus}</Pill>
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
                        <DropdownMenuContent align="end" className="w-44">
                          {row.paymentStatus === "approved" ? (
                            <DropdownMenuItem onClick={() => statusMut.mutate({ id: row.id, status: "pending" })}>
                              <Clock className="mr-2 h-3.5 w-3.5" /> Mark pending
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => statusMut.mutate({ id: row.id, status: "paid" })}>
                              <BadgeCheck className="mr-2 h-3.5 w-3.5" /> Mark paid
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-danger focus:text-danger"
                            onClick={() => setDeleteTarget({ id: row.id, name: row.name })}
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
                    <td colSpan={8} className="px-3.5 py-6 text-center text-[11px] text-text-3">
                      No enrollments match your search.
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
        title="Enroll Youth · 2026"
        description="The youth must already be registered. Enter their CDM No. and the bank payment reference (optional)."
        fields={enrollFields}
        submitLabel="Save Enrollment"
        onSubmit={(values) => createMut.mutate({ cdmId: values.cdmId.trim(), paymentRef: values.paymentRef })}
      />
      <RecordFormDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import enrollments"
        description={`File: ${pendingFileName} · ${pendingRows.length} CDM IDs. Per-row paymentRef is used when present; otherwise the bulk payment reference below applies.`}
        fields={importFields}
        submitLabel="Import & save payment"
        onSubmit={(values) => {
          const ref = values.paymentRef?.trim() || null;
          bulkMut.mutate({ rows: pendingRows, ref });
        }}
      />
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove enrollment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the {new Date().getFullYear()} enrollment for <strong>{deleteTarget?.name}</strong>. The youth record stays intact.
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
