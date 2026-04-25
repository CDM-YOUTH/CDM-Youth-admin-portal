import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CUSA_INSTITUTIONS, buildCusaMembers, cusaMembersFor } from "@/lib/cusa-data";
import { ANALYTICS_UNITS, ORGANIZATION, type AnalyticsUnit } from "@/lib/mock-data";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";

export const Route = createFileRoute("/admin/cusa")({
  head: () => ({
    meta: [
      { title: "CUSA — CDM Youth Office" },
      { name: "description", content: "Catholic University Students Association: chapters, members, and events." },
    ],
  }),
  component: CusaPage,
});

type FilterState = { deaneryCode: string; parishId: string; churchId: string; institution: string };
const emptyFilters: FilterState = { deaneryCode: "", parishId: "", churchId: "", institution: "" };

function CusaPage() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const selectedDeanery = ORGANIZATION.find((deanery) => deanery.code === filters.deaneryCode);
  const selectedParish = selectedDeanery?.parishes.find((parish) => parish.id === filters.parishId);
  const units = useMemo(() => filterUnits(filters), [filters]);
  const members = buildCusaMembers(units, filters.institution);
  const totalMembers = units.reduce((sum, unit) => sum + cusaMembersFor(unit, filters.institution), 0);
  const activeMembers = members.filter((member) => member.status === "active").length;
  const pagination = usePagination(members, 15);

  return (
    <>
      <Topbar title="CUSA" action={<TopbarButton>+ New Chapter</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Catholic University Students Association"
          description="Tertiary-level youth body — chapters, leadership, and retreats."
        />

        <CusaFilters filters={filters} setFilters={setFilters} selectedDeanery={selectedDeanery} selectedParish={selectedParish} />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Members" value={totalMembers.toLocaleString()} trend={`${activeMembers} active`} tone="up" accent="var(--color-violet)" />
          <Kpi label="Institutions" value={String(new Set(members.map((member) => member.institution)).size)} trend="filtered" tone="up" accent="var(--color-violet)" />
          <Kpi label="Parishes" value={String(new Set(units.map((unit) => unit.parishId)).size)} trend="represented" tone="up" accent="var(--color-violet)" />
          <Kpi label="Upcoming Retreats" value="3" trend="next 60d" tone="info" accent="var(--color-violet)" />
        </div>

        <Card>
          <CardHead title="CUSA Members" subtitle="Member register filtered by deanery, parish, outstation, and institution" action="Export →" />
          <CardBody className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Name", "Institution", "Deanery", "Parish", "Outstation", "Gender", "Course", "Status"].map((heading) => <TableHead key={heading} className="label-eyebrow px-3 py-2">{heading}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.pageRows.map((member) => (
                  <TableRow key={member.id} className="border-border/30 hover:bg-bg-3">
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

function filterUnits(filters: FilterState): AnalyticsUnit[] {
  return ANALYTICS_UNITS.filter((unit) => {
    if (filters.deaneryCode && unit.deaneryCode !== filters.deaneryCode) return false;
    if (filters.parishId && unit.parishId !== filters.parishId) return false;
    if (filters.churchId && unit.id !== filters.churchId) return false;
    return true;
  });
}

function CusaFilters({ filters, setFilters, selectedDeanery, selectedParish }: { filters: FilterState; setFilters: (filters: FilterState) => void; selectedDeanery?: (typeof ORGANIZATION)[number]; selectedParish?: (typeof ORGANIZATION)[number]["parishes"][number] }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5">
      <span className="label-eyebrow">Filter by</span>
      <select value={filters.deaneryCode} onChange={(event) => setFilters({ ...emptyFilters, deaneryCode: event.target.value })} className="min-w-[148px] rounded-md border border-gold-3 bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-gold outline-none">
        <option value="">All Deaneries</option>
        {ORGANIZATION.map((deanery) => <option key={deanery.code} value={deanery.code}>{deanery.name}</option>)}
      </select>
      <select value={filters.parishId} disabled={!selectedDeanery} onChange={(event) => setFilters({ ...filters, parishId: event.target.value, churchId: "" })} className="min-w-[148px] rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-text-2 outline-none disabled:opacity-40">
        <option value="">All Parishes</option>
        {selectedDeanery?.parishes.map((parish) => <option key={parish.id} value={parish.id}>{parish.name}</option>)}
      </select>
      <select value={filters.churchId} disabled={!selectedParish} onChange={(event) => setFilters({ ...filters, churchId: event.target.value })} className="min-w-[148px] rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-text-2 outline-none disabled:opacity-40">
        <option value="">All Outstations</option>
        {selectedParish?.churches.map((church) => <option key={church.id} value={church.id}>{church.name}</option>)}
      </select>
      <select value={filters.institution} onChange={(event) => setFilters({ ...filters, institution: event.target.value })} className="min-w-[168px] rounded-md border border-violet bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold text-violet outline-none">
        <option value="">All Institutions</option>
        {CUSA_INSTITUTIONS.map((institution) => <option key={institution} value={institution}>{institution}</option>)}
      </select>
      <button onClick={() => setFilters(emptyFilters)} className="rounded-md border border-border bg-transparent px-2.5 py-1 text-[9px] text-text-3 hover:border-danger hover:text-danger">✕ Clear</button>
    </div>
  );
}
