import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Topbar } from "@/components/admin/topbar";
import { Card, CardBody, PageHeader, Pill } from "@/components/admin/ui-bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CUSA_INSTITUTIONS, buildCusaMembers } from "@/lib/cusa-data";
import { ANALYTICS_UNITS, ORGANIZATION } from "@/lib/mock-data";
import { TablePagination, usePagination } from "@/components/admin/table-pagination";
import {
  ColumnFilter,
  ColumnHeader,
  TableToolbar,
  applyColumnFilter,
  type ColumnFilterValue,
} from "@/components/admin/table-filters";

const filterValueSchema = fallback(
  z
    .object({
      operator: z.enum(["equals", "contains", "startsWith", "notEquals"]),
      value: z.string(),
    })
    .optional(),
  undefined,
);

const cusaSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  f_cdm: filterValueSchema,
  f_name: filterValueSchema,
  f_institution: filterValueSchema,
  f_deanery: filterValueSchema,
  f_parish: filterValueSchema,
  f_outstation: filterValueSchema,
  f_gender: filterValueSchema,
  f_status: filterValueSchema,
});

type CusaSearch = z.infer<typeof cusaSearchSchema>;

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
  const setFilter = (patch: Partial<CusaSearch>) => {
    navigate({ search: (prev: CusaSearch) => ({ ...prev, ...patch }), replace: true });
  };

  const allMembers = useMemo(() => buildCusaMembers(ANALYTICS_UNITS, ""), []);

  const filteredMembers = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return allMembers.filter((member) => {
      if (!applyColumnFilter(member.cdmId, search.f_cdm)) return false;
      if (!applyColumnFilter(member.name, search.f_name)) return false;
      if (!applyColumnFilter(member.institution, search.f_institution)) return false;
      if (!applyColumnFilter(member.deaneryName, search.f_deanery)) return false;
      if (!applyColumnFilter(member.parishName, search.f_parish)) return false;
      if (!applyColumnFilter(member.churchName, search.f_outstation)) return false;
      if (!applyColumnFilter(member.gender, search.f_gender)) return false;
      if (!applyColumnFilter(member.status, search.f_status)) return false;
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
  }, [allMembers, search]);

  const pagination = usePagination(filteredMembers, 15);

  const deaneryOptions = ORGANIZATION.map((d) => ({ value: d.name, label: d.name }));
  const parishOptions = Array.from(
    new Set(ORGANIZATION.flatMap((d) => d.parishes.map((p) => p.name))),
  ).map((name) => ({ value: name, label: name }));
  const outstationOptions = Array.from(
    new Set(
      ORGANIZATION.flatMap((d) => d.parishes.flatMap((p) => p.churches.map((c) => c.name))),
    ),
  ).map((name) => ({ value: name, label: name }));

  const fc = (key: keyof CusaSearch, label: string, mode: "text" | "select" = "text", options?: { value: string; label: string }[]) => (
    <ColumnFilter
      label={label}
      mode={mode}
      options={options}
      value={search[key] as ColumnFilterValue | undefined}
      onChange={(v) => setFilter({ [key]: v } as Partial<CusaSearch>)}
    />
  );

  return (
    <>
      <Topbar title="CUSA" />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader
          title="Catholic University Students Association"
          description={`${filteredMembers.length.toLocaleString()} of ${allMembers.length.toLocaleString()} members shown — share this URL to share the same view.`}
        />

        <Card>
          <TableToolbar
            searchValue={search.q}
            onSearchChange={(value) => setFilter({ q: value })}
            searchPlaceholder="Search name, CDM No., institution, parish…"
            onImport={() => {}}
            onExport={() => {}}
            onAdd={() => {}}
            addLabel="Add Member"
          />
          <CardBody className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader label="CDM No." filter={fc("f_cdm", "CDM No.")} />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader label="Name" filter={fc("f_name", "Name")} />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader
                      label="Institution"
                      filter={fc("f_institution", "Institution", "select", CUSA_INSTITUTIONS.map((i) => ({ value: i, label: i })))}
                    />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader label="Deanery" filter={fc("f_deanery", "Deanery", "select", deaneryOptions)} />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader label="Parish" filter={fc("f_parish", "Parish", "select", parishOptions)} />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader label="Outstation" filter={fc("f_outstation", "Outstation", "select", outstationOptions)} />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader
                      label="Gender"
                      filter={fc("f_gender", "Gender", "select", [
                        { value: "Female", label: "Female" },
                        { value: "Male", label: "Male" },
                      ])}
                    />
                  </TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">Course</TableHead>
                  <TableHead className="label-eyebrow px-3 py-2">
                    <ColumnHeader
                      label="Status"
                      filter={fc("f_status", "Status", "select", [
                        { value: "active", label: "Active" },
                        { value: "reporting", label: "Reporting" },
                      ])}
                    />
                  </TableHead>
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
