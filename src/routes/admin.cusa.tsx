import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
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
import { RecordFormDialog, type FieldDef } from "@/components/admin/record-form-dialog";

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
  const [addOpen, setAddOpen] = useState(false);
  const setFilter = (patch: Partial<CusaSearch>) => {
    navigate({ search: (prev: CusaSearch) => ({ ...prev, ...patch }), replace: true });
  };
  const setDeaneryFilter = (v: ColumnFilterValue | undefined) => {
    // changing deanery clears parish + outstation
    navigate({
      search: (prev: CusaSearch) => ({ ...prev, f_deanery: v, f_parish: undefined, f_outstation: undefined }),
      replace: true,
    });
  };
  const setParishFilter = (v: ColumnFilterValue | undefined) => {
    navigate({
      search: (prev: CusaSearch) => ({ ...prev, f_parish: v, f_outstation: undefined }),
      replace: true,
    });
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

  const nextCusaId = useMemo(() => {
    const max = allMembers.reduce((m, r) => {
      const n = parseInt(r.cdmId.replace(/\D/g, "").slice(-4) || "0", 10);
      return n > m ? n : m;
    }, 0);
    return `CDM-2026-C${String(max + 1).padStart(4, "0")}`;
  }, [allMembers]);

  const cusaFields: FieldDef[] = [
    { key: "cdmId", label: "Unique CUSA No.", placeholder: nextCusaId },
    { key: "fullName", label: "Full name", required: true, placeholder: "Grace Wanjiku" },
    { key: "gender", label: "Gender", type: "select", options: ["Female", "Male"], required: true },
    { key: "phone", label: "Phone", type: "tel" },
    { key: "email", label: "Email", type: "email", placeholder: "name@uni.ac.ke" },
    { key: "institution", label: "Institution", type: "select", options: [...CUSA_INSTITUTIONS], required: true },
    { key: "course", label: "Course", placeholder: "e.g. Education", required: true },
    { key: "year", label: "Year of study", type: "select", options: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"], required: true },
    {
      key: "deanery", label: "Home deanery", type: "select", required: true,
      options: ORGANIZATION.map((d) => d.name),
    },
    {
      key: "parish", label: "Home parish", type: "select", required: true,
      dynamicOptions: (v) => ORGANIZATION.find((d) => d.name === v.deanery)?.parishes.map((p) => p.name) ?? [],
    },
    {
      key: "outstation", label: "Home outstation", type: "select",
      dynamicOptions: (v) => {
        const d = ORGANIZATION.find((d) => d.name === v.deanery);
        const p = d?.parishes.find((p) => p.name === v.parish);
        return p?.churches.map((c) => c.name) ?? [];
      },
    },
    { key: "status", label: "Status", type: "select", options: ["active", "reporting"], required: true },
  ];

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
            onImport={() => toast.info("Import CUSA members — bring CSV soon")}
            onExport={() => toast.success(`Exporting ${filteredMembers.length} CUSA members`)}
            onAdd={() => setAddOpen(true)}
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
      <RecordFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add CUSA Member"
        description={`Auto-assigned No.: ${nextCusaId}`}
        fields={cusaFields}
        submitLabel="Save Member"
        onSubmit={(values) => {
          const id = values.cdmId?.trim() || nextCusaId;
          toast.success(`${values.fullName} added to CUSA · ${id}`);
        }}
      />
    </>
  );
}
