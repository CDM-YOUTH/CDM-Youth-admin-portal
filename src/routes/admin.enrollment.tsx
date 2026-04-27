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

const enrollmentSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  gender: fallback(z.string(), "").default(""),
  deanery: fallback(z.string(), "").default(""),
  parish: fallback(z.string(), "").default(""),
  outstation: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
});

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
  const setFilter = (patch: Partial<typeof search>) => {
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }), replace: true });
  };

  const selectedDeanery = ORGANIZATION.find((deanery) => deanery.code === search.deanery);
  const selectedParish = selectedDeanery?.parishes.find((parish) => parish.id === search.parish);

  const enrollmentRows = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return YOUTH_REGISTRY.filter((row) => row.enrolled)
      .map((row, index) => ({
        ...row,
        paymentStatus: index % 7 === 0 ? "pending" : "approved",
        fee: FEE_BY_CATEGORY[row.category] ?? "KES 500",
      }))
      .filter((row) => {
        if (search.gender && row.gender !== search.gender) return false;
        if (search.deanery && row.deaneryCode !== search.deanery) return false;
        if (search.parish && row.parishId !== search.parish) return false;
        if (search.outstation && row.churchId !== search.outstation) return false;
        if (search.category && row.category !== search.category) return false;
        if (search.status && row.paymentStatus !== search.status) return false;
        if (q) {
          const haystack = [row.cdmId, row.name, row.parishName, row.deaneryName, row.churchName].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
  }, [search]);

  const pagination = usePagination(enrollmentRows, 10);
  const totalActiveFilters =
    (search.q ? 1 : 0) +
    (search.gender ? 1 : 0) +
    (search.deanery ? 1 : 0) +
    (search.parish ? 1 : 0) +
    (search.outstation ? 1 : 0) +
    (search.category ? 1 : 0) +
    (search.status ? 1 : 0);

  return (
    <>
      <Topbar title="Enrollment" action={<TopbarButton>+ Enroll Youth</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Annual Enrollment 2026"
          description={`${enrollmentRows.length.toLocaleString()} matching enrollments — share this URL to share the same view.`}
        />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Enrolled" value="8,240" trend="75% of target" tone="up" sub="of 11,000" />
          <Kpi label="Pending Payment" value="412" trend="KES 206,000" tone="warn" sub="outstanding" />
          <Kpi label="Awaiting Approval" value="23" trend="parish review" tone="warn" sub="queue" />
          <Kpi label="Self-Registered" value="3,180" trend="39% of total" tone="info" sub="via portal" />
        </div>

        <Card>
          <CardHead
            title="Enrollment Register"
            subtitle="Search by name, CDM No., deanery, parish, outstation. All filters live in the URL."
            action={<ActiveFilterCount count={totalActiveFilters} />}
          />
          <CardBody className="p-0">
            <FilterRow>
              <FilterSearch
                value={search.q}
                onChange={(value) => setFilter({ q: value })}
                placeholder="Search name, CDM No., parish, deanery, outstation…"
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
                label="Any Payment"
                value={search.status}
                onChange={(value) => setFilter({ status: value })}
                options={[
                  { value: "approved", label: "Approved" },
                  { value: "pending", label: "Pending" },
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
                  {["CDM No.", "Name", "Deanery", "Parish", "Category", "Fee", "Payment"].map((h) => (
                    <th key={h} className="label-eyebrow px-3.5 py-2.5 text-left">{h}</th>
                  ))}
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
