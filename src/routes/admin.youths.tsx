import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";
import {
  ActiveFilterCount,
  FilterClear,
  FilterRow,
  FilterSearch,
  FilterSelect,
} from "@/components/admin/table-filters";
import { ORGANIZATION } from "@/lib/mock-data";
import { YOUTH_CATEGORIES, YOUTH_GENDERS, YOUTH_REGISTRY } from "@/lib/youth-data";

const youthSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  gender: fallback(z.string(), "").default(""),
  deanery: fallback(z.string(), "").default(""),
  parish: fallback(z.string(), "").default(""),
  outstation: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
});

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

  const setFilter = (patch: Partial<typeof search>) => {
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }), replace: true });
  };

  const selectedDeanery = ORGANIZATION.find((deanery) => deanery.code === search.deanery);
  const selectedParish = selectedDeanery?.parishes.find((parish) => parish.id === search.parish);

  const filtered = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return YOUTH_REGISTRY.filter((row) => {
      if (search.gender && row.gender !== search.gender) return false;
      if (search.deanery && row.deaneryCode !== search.deanery) return false;
      if (search.parish && row.parishId !== search.parish) return false;
      if (search.outstation && row.churchId !== search.outstation) return false;
      if (search.category && row.category !== search.category) return false;
      if (search.status && row.status !== search.status) return false;
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

  const totalActiveFilters =
    (search.q ? 1 : 0) +
    (search.gender ? 1 : 0) +
    (search.deanery ? 1 : 0) +
    (search.parish ? 1 : 0) +
    (search.outstation ? 1 : 0) +
    (search.category ? 1 : 0) +
    (search.status ? 1 : 0);

  const totals = YOUTH_REGISTRY.length;
  const activeCount = YOUTH_REGISTRY.filter((y) => y.status === "active").length;
  const enrolledCount = YOUTH_REGISTRY.filter((y) => y.enrolled).length;

  return (
    <>
      <Topbar title="Youth Records" action={<TopbarButton>Export CSV</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Youth Directory"
          description={`${filtered.length.toLocaleString()} of ${totals.toLocaleString()} youths shown · share this URL to share the same view.`}
        />
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Total" value={totals.toLocaleString()} trend="registry sample" tone="up" />
          <Kpi label="Active" value={activeCount.toLocaleString()} trend={`${Math.round((activeCount / totals) * 100)}%`} tone="up" />
          <Kpi label="Enrolled (2026)" value={enrolledCount.toLocaleString()} trend="confirmed" tone="info" />
          <Kpi label="In View" value={filtered.length.toLocaleString()} trend={`${totalActiveFilters} filter${totalActiveFilters === 1 ? "" : "s"}`} tone={totalActiveFilters ? "warn" : "info"} />
        </div>

        <Card>
          <CardHead
            title="All Youths"
            subtitle="Filter by name, CDM No., deanery, parish, outstation, category or gender — every filter is in the URL."
            action={<ActiveFilterCount count={totalActiveFilters} />}
          />
          <CardBody className="p-0">
            <FilterRow>
              <FilterSearch
                value={search.q}
                onChange={(value) => setFilter({ q: value })}
                placeholder="Search name, CDM No., parish, deanery, outstation, institution…"
              />
              <FilterSelect
                label="All Genders"
                value={search.gender}
                onChange={(value) => setFilter({ gender: value })}
                options={YOUTH_GENDERS.map((g) => ({ value: g, label: g }))}
                accent="pink"
              />
              <FilterSelect
                label="All Deaneries"
                value={search.deanery}
                onChange={(value) => setFilter({ deanery: value, parish: "", outstation: "" })}
                options={ORGANIZATION.map((d) => ({ value: d.code, label: d.name }))}
                accent="gold"
              />
              <FilterSelect
                label="All Parishes"
                value={search.parish}
                onChange={(value) => setFilter({ parish: value, outstation: "" })}
                options={(selectedDeanery?.parishes ?? []).map((p) => ({ value: p.id, label: p.name }))}
                disabled={!selectedDeanery}
              />
              <FilterSelect
                label="All Outstations"
                value={search.outstation}
                onChange={(value) => setFilter({ outstation: value })}
                options={(selectedParish?.churches ?? []).map((c) => ({ value: c.id, label: c.name }))}
                disabled={!selectedParish}
              />
              <FilterSelect
                label="All Categories"
                value={search.category}
                onChange={(value) => setFilter({ category: value })}
                options={YOUTH_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
              <FilterSelect
                label="Any Status"
                value={search.status}
                onChange={(value) => setFilter({ status: value })}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
              <FilterClear
                visible={totalActiveFilters > 0}
                onClick={() =>
                  setFilter({ q: "", gender: "", deanery: "", parish: "", outstation: "", category: "", status: "" })
                }
              />
            </FilterRow>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["CDM No.", "Name", "Sex", "Age", "Deanery", "Parish", "Outstation", "Category", "Status"].map((h) => (
                    <th key={h} className="label-eyebrow px-3.5 py-2.5 text-left">{h}</th>
                  ))}
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
