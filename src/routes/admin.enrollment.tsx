import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { downloadXlsx } from "@/lib/export-xlsx";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { Download, MoreVertical, Trash2, BadgeCheck, Clock, Plus } from "lucide-react";
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
import { ORGANIZATION } from "@/lib/mock-data";
import { YouthSearchInput, type PickedYouth } from "@/components/admin/composables/pickers/youth-search-input";
import { fetchOrg, type OrgTree } from "@/lib/db/org";
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
import { YOUTH_CATEGORIES } from "@/lib/youth-data";
import {
  bulkEnrollRows,
  createEnrollment,
  deleteEnrollment,
  listEnrollmentsPaged,
  updateEnrollmentStatus,
  type BulkEnrollRow,
  type EnrollmentRow,
} from "@/lib/db/youth-records/enrollments";
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

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => CURRENT_YEAR - i);

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
  // Server-side params
  year: fallback(z.number(), CURRENT_YEAR).default(CURRENT_YEAR),
  q: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
  deanery_id: fallback(z.string(), "").default(""),
  parish_id: fallback(z.string(), "").default(""),
  outstation_id: fallback(z.string(), "").default(""),
  page: fallback(z.number().int().min(1), 1).default(1),
  size: fallback(z.number().int().min(1).max(100), 10).default(10),
  // Client-side column filters on current page
  f_cdm: filterValueSchema,
  f_name: filterValueSchema,
  f_category: filterValueSchema,
  f_payment: filterValueSchema,
});

type EnrollmentSearch = z.infer<typeof enrollmentSearchSchema>;

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
  const [statusTarget, setStatusTarget] = useState<null | { id: string; name: string; nextStatus: "paid" | "pending" }>(null);
  const [importResult, setImportResult] = useState<null | { inserted: number; missing: string[]; total: number }>(null);
  const qc = useQueryClient();
  const scope = useAdminScope();
  const deaneryId    = scope.deaneryId || search.deanery_id;
  const parishId     = scope.parishId  || search.parish_id;
  const outstationId = search.outstation_id;
  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const { data: resp, isLoading } = useQuery({
    queryKey: ["enrollments", search.year, search.page - 1, search.size, search.q, search.status, deaneryId, parishId, outstationId],
    queryFn: () =>
      listEnrollmentsPaged({
        page: search.page - 1,
        size: search.size,
        year: search.year || null,
        q: search.q,
        status: search.status || null,
        deaneryId:    deaneryId    || null,
        parishId:     parishId     || null,
        outstationId: outstationId || null,
      }),
    placeholderData: keepPreviousData,
  });
  const total = resp?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / search.size));
  const createMut = useMutation({
    mutationFn: (vals: { cdmId: string; paymentRef?: string }) =>
      createEnrollment({ cdmId: vals.cdmId, paymentRef: vals.paymentRef || null, year: search.year }),
    onSuccess: () => {
      toast.success("Enrollment saved");
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const bulkMut = useMutation({
    mutationFn: ({ rows, ref }: { rows: BulkEnrollRow[]; ref: string | null }) =>
      bulkEnrollRows(rows, ref, search.year),
    onSuccess: (res, vars) => {
      setImportResult({ inserted: res.inserted, missing: res.missing, total: vars.rows.length });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEnrollment(id),
    onSuccess: () => {
      toast.success("Enrollment removed");
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "paid" | "pending" }) =>
      updateEnrollmentStatus(id, status),
    onSuccess: () => {
      toast.success("Payment status updated");
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      qc.invalidateQueries({ queryKey: ["live-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const setFilter = (patch: Partial<EnrollmentSearch>) => {
    navigate({ search: (prev: EnrollmentSearch) => ({ ...prev, ...patch, page: 1 }), replace: true });
  };

  const enrollmentRows = useMemo(
    () =>
      (resp?.data ?? []).map((e) => ({
        id: e.id,
        cdmId: e.youth?.cdm_id ?? "",
        name: e.youth?.full_name ?? "",
        deaneryName: e.youth?.deanery?.name ?? "",
        parishName: e.youth?.parish?.name ?? "",
        outstationName: e.youth?.outstation?.name ?? "",
        category: e.youth?.category ?? "",
        fee: FEE_BY_CATEGORY[e.youth?.category ?? ""] ?? "KES 500",
        paymentStatus: e.status === "paid" ? "approved" : "pending",
      })),
    [resp],
  );

  // Client-side column filters on current page
  const displayRows = useMemo(() => {
    if (!search.f_cdm && !search.f_name && !search.f_category && !search.f_payment) return enrollmentRows;
    return enrollmentRows.filter((row) => {
      if (!applyColumnFilter(row.cdmId, search.f_cdm)) return false;
      if (!applyColumnFilter(row.name, search.f_name)) return false;
      if (!applyColumnFilter(row.category, search.f_category)) return false;
      if (!applyColumnFilter(row.paymentStatus, search.f_payment)) return false;
      return true;
    });
  }, [enrollmentRows, search.f_cdm, search.f_name, search.f_category, search.f_payment]);

  const deaneryOptions = (org?.deaneries ?? []).map((d) => ({ value: d.id, label: d.name }));
  const parishOptions = (org?.parishes ?? [])
    .filter((p) => !deaneryId || p.deanery_id === deaneryId)
    .map((p) => ({ value: p.id, label: p.name }));
  const outstationOptions = (org?.outstations ?? [])
    .filter((o) => !parishId || o.parish_id === parishId)
    .map((o) => ({ value: o.id, label: o.name }));

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

  const SAMPLE_HEADERS = ["CDM NO.", "FULL NAME", "PAYMENT REF"];
  const downloadSample = () => {
    const sampleRows = [
      ["CDM-2026-00001", "Grace Wanjiku", "BANK-2026-001"],
      ["CDM-2026-00002", "Peter Mwangi", "BANK-2026-001"],
      ["CDM-2026-00003", "Mary Njeri", ""],
    ];
    downloadXlsx("enrollment-import-sample", "Enrollment Sample", SAMPLE_HEADERS, sampleRows, undefined, { headerTextColor: "FFAAAA" })
      .then(() => toast.success("Import sample downloaded"))
      .catch((e: Error) => toast.error(e.message));
  };
  const onPickFile = () => fileInputRef.current?.click();
  const handleImportFile = (file: File) => {
    setPendingFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rawFields = res.meta.fields ?? [];
        // Normalize: lowercase, strip spaces/underscores/dots for flexible matching
        const nk = (h: string) => h.trim().toLowerCase().replace(/[\s_.-]+/g, "");
        const fieldMap: Record<string, string> = {};
        rawFields.forEach(h => { fieldMap[nk(h)] = h; });
        const normHeaders = rawFields.map(nk);
        const get = (r: Record<string, string>, ...keys: string[]) =>
          keys.map(k => r[fieldMap[nk(k)]] ?? "").find(v => v) ?? "";

        // CDM column: "CDM NO.", "cdmId", "cdm_id", "CDM No.", "cdm" all normalize to "cdmno" or "cdmid"/"cdm"
        const hasCdm = normHeaders.some(h => h === "cdmno" || h === "cdmid" || h === "cdm");
        if (!hasCdm) {
          toast.error("CSV is missing required column: CDM NO.", {
            description: `Found columns: ${rawFields.join(", ") || "(none)"} — download the sample for the expected header row.`,
          });
          return;
        }
        const knownNorm = new Set(["cdmno", "cdmid", "cdm", "fullname", "name", "paymentref"]);
        const unknown = rawFields.filter(h => !knownNorm.has(nk(h)));
        if (unknown.length) {
          toast.message(`Ignoring unknown columns: ${unknown.join(", ")}`, {
            description: "Recognised: CDM NO., FULL NAME, PAYMENT REF.",
          });
        }
        if (!normHeaders.some(h => h === "paymentref")) {
          toast.message("Heads up: no payment ref column", {
            description: "All rows will use the bulk payment reference you enter on the next step.",
          });
        }
        const rows: BulkEnrollRow[] = res.data
          .map((r) => ({
            cdmId: get(r, "CDM NO.", "cdmId", "cdm_id", "CDM No.", "cdm").trim(),
            paymentRef: get(r, "PAYMENT REF", "paymentRef", "payment_ref").trim() || null,
          }))
          .filter((r) => r.cdmId);
        if (!rows.length) {
          toast.error("CSV has the right columns but no rows with a CDM No.");
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
      <Topbar
        title={`Annual Enrollment ${search.year}`}
        description={isLoading ? "Loading enrollments…" : `${enrollmentRows.length.toLocaleString()} matching enrollments. A youth must be registered (CDM No.) before being enrolled.`}
        action={
          <>
            <select
              value={search.year}
              onChange={(e) => setFilter({ year: Number(e.target.value) })}
              aria-label="Select enrollment year"
              className="h-8 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 outline-none transition hover:border-gold-3 focus:border-gold-3"
            >
              {AVAILABLE_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[11px] font-bold text-white transition hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Enroll Youth
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          <TableToolbar
            searchValue={search.q}
            onSearchChange={(value) => setFilter({ q: value })}
            searchPlaceholder="Search name, CDM No., parish, deanery, outstation…"
            onImport={onPickFile}
            onExport={() => {
              const headers = ["CDM No.", "Full Name", "Deanery", "Parish", "Category", "Fee", "Payment Status"];
              const data: (string | number | null)[][] = enrollmentRows.map((r) => [r.cdmId, r.name, r.deaneryName, r.parishName, r.category, r.fee, r.paymentStatus]);
              downloadXlsx("enrollment-export", "Enrollment 2026", headers, data).then(() => toast.success(`Exported ${enrollmentRows.length} enrollments`)).catch((e: Error) => toast.error(e.message));
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
                          value={outstationId ? { operator: "equals", value: outstationId } : undefined}
                          onChange={(v) => setFilter({ outstation_id: v?.value ?? "" })}
                        />
                      }
                    />
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
                {displayRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                    <td className="px-3.5 py-2.5 font-mono text-[10px] font-bold text-gold">{row.cdmId}</td>
                    <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">{row.name}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">{row.deaneryName}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-1">{row.parishName}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">{row.outstationName}</td>
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
                            <DropdownMenuItem onClick={() => setStatusTarget({ id: row.id, name: row.name, nextStatus: "pending" })}>
                              <Clock className="mr-2 h-3.5 w-3.5" /> Mark pending
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setStatusTarget({ id: row.id, name: row.name, nextStatus: "paid" })}>
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
                {displayRows.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={9} className="px-3.5 py-6 text-center text-[11px] text-text-3">
                      No enrollments match your search.
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
              onPageChange={(p) => navigate({ search: (prev: EnrollmentSearch) => ({ ...prev, page: p }), replace: true })}
              onPageSizeChange={(s) => navigate({ search: (prev: EnrollmentSearch) => ({ ...prev, size: s, page: 1 }), replace: true })}
            />
          </CardBody>
        </Card>

      </div>
      <EnrollDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        year={search.year}
        org={org}
        isPending={createMut.isPending}
        onSubmit={(cdmId, paymentRef) => createMut.mutate({ cdmId, paymentRef })}
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
      <AlertDialog open={statusTarget !== null} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.nextStatus === "paid" ? "Mark as paid?" : "Mark as pending?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              The {new Date().getFullYear()} enrollment for <strong>{statusTarget?.name}</strong> will be set to{" "}
              <strong>{statusTarget?.nextStatus}</strong>. Dashboard counts update immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusTarget) statusMut.mutate({ id: statusTarget.id, status: statusTarget.nextStatus });
                setStatusTarget(null);
              }}
            >
              Confirm
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
                  Saved <strong>{importResult?.inserted ?? 0}</strong> of {importResult?.total ?? 0} enrollments.
                </div>
                {importResult && importResult.missing.length > 0 && (
                  <div>
                    <div className="font-semibold text-danger">{importResult.missing.length} CDM No(s) not found in Youth Records:</div>
                    <div className="mt-1 max-h-40 overflow-y-auto rounded border border-border bg-bg-2 p-2 font-mono text-[10px]">
                      {importResult.missing.join(", ")}
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

/* ------------------------------------------------------------------ */
/* Enroll dialog                                                       */
/* ------------------------------------------------------------------ */

function EnrollDialog({
  open,
  onOpenChange,
  year,
  org,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  org?: OrgTree;
  isPending: boolean;
  onSubmit: (cdmId: string, paymentRef?: string) => void;
}) {
  const [youth, setYouth]         = useState<PickedYouth | null>(null);
  const [paymentRef, setPaymentRef] = useState("");

  useEffect(() => {
    if (open) { setYouth(null); setPaymentRef(""); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            Enroll Youth · {year}
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

          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Payment reference (optional)</span>
            <Input
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="Bank slip / transaction ref"
            />
          </label>
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
            onClick={() => {
              if (!youth) { toast.error("Select a youth first"); return; }
              onSubmit(youth.cdm_id, paymentRef.trim() || undefined);
            }}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save Enrollment"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Script — constants & config                                         */
/* ------------------------------------------------------------------ */

const FEE_BY_CATEGORY: Record<string, string> = {
  Primary: "KES 300",
  Secondary: "KES 500",
  Tertiary: "KES 800",
  Working: "KES 1,000",
};
