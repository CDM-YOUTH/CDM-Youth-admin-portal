import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CUSA_INSTITUTIONS, buildCusaMembers, cusaMembersFor } from "@/lib/cusa-data";
import { ANALYTICS_UNITS, ORGANIZATION, type AnalyticsUnit } from "@/lib/mock-data";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";
import {
  ActiveFilterCount,
  FilterClear,
  FilterRow,
  FilterSearch,
  FilterSelect,
} from "@/components/admin/table-filters";

const cusaSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  gender: fallback(z.string(), "").default(""),
  deanery: fallback(z.string(), "").default(""),
  parish: fallback(z.string(), "").default(""),
  outstation: fallback(z.string(), "").default(""),
  institution: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/admin/cusa")({
  head: () => ({
    meta: [
      { title: "CUSA — CDM Youth Office" },
      { name: "description", content: "Catholic University Students Association: chapters, members, and events." },
    ],
  }),
  validateSearch: zodValidator(cusaSearchSchema),
  component: CusaPage,
});

function CusaPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setFilter = (patch: Partial<typeof search>) => {
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }), replace: true });
  };

  const selectedDeanery = ORGANIZATION.find((deanery) => deanery.code === search.deanery);
  const selectedParish = selectedDeanery?.parishes.find((parish) => parish.id === search.parish);

  const units = useMemo(() => filterUnits(search), [search.deanery, search.parish, search.outstation]);
  const allMembers = useMemo(() => buildCusaMembers(units, search.institution), [units, search.institution]);

  const filteredMembers = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return allMembers.filter((member) => {
      if (search.gender && member.gender !== search.gender) return false;
      if (search.status && member.status !== search.status) return false;
      if (q) {
        const haystack = [
          member.cdmId,
          member.name,
          member.institution,
          member.deaneryName,
          member.parishName,
          member.churchName,
          member.course,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allMembers, search.q, search.gender, search.status]);

  const totalMembers = units.reduce((sum, unit) => sum + cusaMembersFor(unit, search.institution), 0);
  const activeMembers = filteredMembers.filter((member) => member.status === "active").length;
  const pagination = usePagination(filteredMembers, 15);

  const totalActiveFilters =
    (search.q ? 1 : 0) +
    (search.gender ? 1 : 0) +
    (search.deanery ? 1 : 0) +
    (search.parish ? 1 : 0) +
    (search.outstation ? 1 : 0) +
    (search.institution ? 1 : 0) +
    (search.status ? 1 : 0);

  return (
    <>
      <Topbar title="CUSA" action={<TopbarButton>+ New Chapter</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Catholic University Students Association"
          description={`${filteredMembers.length.toLocaleString()} of ${totalMembers.toLocaleString()} members shown — share this URL to share the same view.`}
        />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Members" value={totalMembers.toLocaleString()} trend={`${activeMembers} active`} tone="up" accent="var(--color-violet)" />
          <Kpi label="Institutions" value={String(new Set(filteredMembers.map((member) => member.institution)).size)} trend="filtered" tone="up" accent="var(--color-violet)" />
          <Kpi label="Parishes" value={String(new Set(units.map((unit) => unit.parishId)).size)} trend="represented" tone="up" accent="var(--color-violet)" />
          <Kpi label="Upcoming Retreats" value="3" trend="next 60d" tone="info" accent="var(--color-violet)" />
        </div>

        <Card>
          <CardHead
            title="CUSA Members"
            subtitle="Search by name, CDM No., institution, deanery, parish or outstation. Every filter is in the URL."
            action={<ActiveFilterCount count={totalActiveFilters} />}
          />
          <CardBody className="p-0">
            <FilterRow>
              <FilterSearch
                value={search.q}
                onChange={(value) => setFilter({ q: value })}
                placeholder="Search name, CDM No., institution, parish…"
              />
              <FilterSelect
                label="All Genders"
                value={search.gender}
                onChange={(value) => setFilter({ gender: value })}
                options={[
                  { value: "Female", label: "Female" },
                  { value: "Male", label: "Male" },
                ]}
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
                label="All Institutions"
                value={search.institution}
                onChange={(value) => setFilter({ institution: value })}
                options={CUSA_INSTITUTIONS.map((i) => ({ value: i, label: i }))}
                accent="violet"
              />
              <FilterSelect
                label="Any Status"
                value={search.status}
                onChange={(value) => setFilter({ status: value })}
                options={[
                  { value: "active", label: "Active" },
                  { value: "reporting", label: "Reporting" },
                ]}
              />
              <FilterClear
                visible={totalActiveFilters > 0}
                onClick={() =>
                  setFilter({ q: "", gender: "", deanery: "", parish: "", outstation: "", institution: "", status: "" })
                }
              />
            </FilterRow>
            <Table>
              <TableHeader>
                <TableRow>
                  {["CDM No.", "Name", "Institution", "Deanery", "Parish", "Outstation", "Gender", "Course", "Status"].map((heading) => <TableHead key={heading} className="label-eyebrow px-3 py-2">{heading}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.pageRows.map((member) => (
                  <TableRow key={member.id} className="border-border/30 hover:bg-bg-3">
                    <TableCell className="px-3 py-2 font-mono text-[10px] font-bold text-violet">{member.cdmId}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] font-semibold text-foreground">{member.name}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-1">{member.institution}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">{member.deaneryName}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">{member.parishName}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">{member.churchName}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">{member.gender}</TableCell>
                    <TableCell className="px-3 py-2 text-[11px] text-text-2">{member.course} · {member.year}</TableCell>
                    <TableCell className="px-3 py-2"><Pill tone={member.status === "active" ? "success" : "violet"}>{member.status}</Pill></TableCell>
                  </TableRow>
                ))}
                {pagination.pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="px-3 py-6 text-center text-[11px] text-text-3">
                      No CUSA members match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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

function filterUnits(filters: { deanery: string; parish: string; outstation: string }): AnalyticsUnit[] {
  return ANALYTICS_UNITS.filter((unit) => {
    if (filters.deanery && unit.deaneryCode !== filters.deanery) return false;
    if (filters.parish && unit.parishId !== filters.parish) return false;
    if (filters.outstation && unit.id !== filters.outstation) return false;
    return true;
  });
}
