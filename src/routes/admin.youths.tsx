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

  const setFilter = (patch: Partial<YouthSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
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
  const parishOptions = Array.from(
    new Set(ORGANIZATION.flatMap((d) => d.parishes.map((p) => p.name))),
  ).map((name) => ({ value: name, label: name }));
  const outstationOptions = Array.from(
    new Set(
      ORGANIZATION.flatMap((d) => d.parishes.flatMap((p) => p.churches.map((c) => c.name))),
    ),
  ).map((name) => ({ value: name, label: name }));

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
            onImport={() => {}}
            onExport={() => {}}
            onAdd={() => {}}
            addLabel="Add Youth"
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
                    <ColumnHeader label="Deanery" filter={fc("f_deanery", "Deanery", "select", deaneryOptions)} />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Parish" filter={fc("f_parish", "Parish", "select", parishOptions)} />
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
                  </tr>
                ))}
                {pagination.pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3.5 py-6 text-center text-[11px] text-text-3">
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
    </>
  );
}
