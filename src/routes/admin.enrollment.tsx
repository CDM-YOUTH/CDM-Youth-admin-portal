import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
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
import { ORGANIZATION } from "@/lib/mock-data";
import { YOUTH_CATEGORIES, YOUTH_REGISTRY } from "@/lib/youth-data";

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
  const setFilter = (patch: Partial<EnrollmentSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  };

  const enrollmentRows = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return YOUTH_REGISTRY.filter((row) => row.enrolled)
      .map((row, index) => ({
        ...row,
        paymentStatus: index % 7 === 0 ? "pending" : "approved",
        fee: FEE_BY_CATEGORY[row.category] ?? "KES 500",
      }))
      .filter((row) => {
        if (!applyColumnFilter(row.cdmId, search.f_cdm)) return false;
        if (!applyColumnFilter(row.name, search.f_name)) return false;
        if (!applyColumnFilter(row.deaneryName, search.f_deanery)) return false;
        if (!applyColumnFilter(row.parishName, search.f_parish)) return false;
        if (!applyColumnFilter(row.category, search.f_category)) return false;
        if (!applyColumnFilter(row.paymentStatus, search.f_payment)) return false;
        if (q) {
          const haystack = [row.cdmId, row.name, row.parishName, row.deaneryName, row.churchName].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
  }, [search]);

  const pagination = usePagination(enrollmentRows, 10);

  const deaneryOptions = ORGANIZATION.map((d) => ({ value: d.name, label: d.name }));
  const parishOptions = Array.from(
    new Set(ORGANIZATION.flatMap((d) => d.parishes.map((p) => p.name))),
  ).map((name) => ({ value: name, label: name }));

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
          description={`${enrollmentRows.length.toLocaleString()} matching enrollments — share this URL to share the same view.`}
        />

        <Card>
          <TableToolbar
            searchValue={search.q}
            onSearchChange={(value) => setFilter({ q: value })}
            searchPlaceholder="Search name, CDM No., parish, deanery, outstation…"
            onImport={() => {}}
            onExport={() => {}}
            onAdd={() => {}}
            addLabel="Enroll Youth"
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
                    <ColumnHeader label="Deanery" filter={fc("f_deanery", "Deanery", "select", deaneryOptions)} />
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
                  </tr>
                ))}
                {pagination.pageRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3.5 py-6 text-center text-[11px] text-text-3">
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
    </>
  );
}
