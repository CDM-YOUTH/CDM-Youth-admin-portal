import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, Search, X } from "lucide-react";
import { Topbar } from "@/components/admin/layout/topbar";
import { Card, CardBody, CardHead, Pill } from "@/components/admin/composables/ui-bits";
import { TablePagination, usePagination } from "@/components/admin/composables/tables/table-pagination";
import { listEnrollmentAudit } from "@/lib/db/audit";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log — CDM Youth Office" },
      { name: "description", content: "Full enrollment change history with actor, timestamps, and before/after data." },
    ],
  }),
  component: AuditPage,
});

const ACTION_TONES: Record<string, "danger" | "info" | "success" | "gold" | "neutral"> = {
  delete: "danger",
  status_change: "info",
  create: "success",
  bulk_create: "success",
  update: "gold",
};

const ACTION_OPTIONS = [
  { value: "create", label: "Create" },
  { value: "bulk_create", label: "Bulk create" },
  { value: "update", label: "Update" },
  { value: "status_change", label: "Status change" },
  { value: "delete", label: "Delete" },
];

function extractSummary(row: { action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const data = row.after ?? row.before ?? {};
  const parts: string[] = [];
  if (data.cdm_id) parts.push(String(data.cdm_id));
  if (data.full_name) parts.push(String(data.full_name));
  if (data.status) parts.push(`status=${data.status}`);
  if (data.payment_ref) parts.push(`ref=${data.payment_ref}`);
  return parts.length ? parts.join(" · ") : JSON.stringify(data).slice(0, 80);
}

function AuditPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const { data: entries = [], isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["enrollment-audit"],
    queryFn: () => listEnrollmentAudit(200),
    refetchInterval: 15_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((a) => {
      if (actionFilter && a.action !== actionFilter) return false;
      if (q) {
        const hay = [
          a.action,
          a.actor ?? "",
          a.enrollment_id ?? "",
          a.youth_id ?? "",
          JSON.stringify(a.after ?? {}),
          JSON.stringify(a.before ?? {}),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, actionFilter]);

  const pagination = usePagination(filtered, 20);

  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <>
      <Topbar
        title="Audit Log"
        description="All enrollment changes — auto-refreshes every 15 seconds."
        action={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          <CardHead
            title={`${filtered.length.toLocaleString()} ${filtered.length === 1 ? "entry" : "entries"}`}
            subtitle={lastRefreshed ? `Last refreshed at ${lastRefreshed}` : "Loading…"}
          />

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3.5 py-2.5">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search actor, CDM No., reference…"
                className="h-8 w-full rounded-md border border-black/20 bg-white pl-8 pr-7 text-[12px] text-black/70 placeholder:text-gray-400 placeholder:font-normal outline-none transition-colors hover:border-gold-3/50 hover:text-black focus:border-gold-3 focus:text-black"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-3 hover:bg-bg-3 hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="Filter by action"
              className="h-8 rounded-md border border-black/20 bg-white px-2.5 text-[11px] font-semibold text-black/70 outline-none transition-colors hover:border-gold-3/50 focus:border-gold-3"
            >
              <option value="">All actions</option>
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <CardBody className="p-0">
            {isLoading ? (
              <div className="px-3.5 py-8 text-center text-[11px] text-text-3">Loading audit log…</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="label-eyebrow px-3.5 py-2.5 text-left">Timestamp</th>
                    <th className="label-eyebrow px-3.5 py-2.5 text-left">Action</th>
                    <th className="label-eyebrow px-3.5 py-2.5 text-left">Summary</th>
                    <th className="label-eyebrow px-3.5 py-2.5 text-left">Actor</th>
                    <th className="label-eyebrow px-3.5 py-2.5 text-left">Enrollment ID</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.pageRows.map((a) => (
                    <tr key={a.id} className="border-b border-border/30 last:border-0 hover:bg-bg-3">
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-[10px] text-text-3">
                        {new Date(a.created_at).toLocaleString([], {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <Pill tone={ACTION_TONES[a.action] ?? "neutral"}>
                          {a.action.replace(/_/g, " ")}
                        </Pill>
                      </td>
                      <td className="max-w-xs px-3.5 py-2.5 text-[11px] text-text-1">
                        <span className="block truncate font-mono text-[10px]">
                          {extractSummary(a)}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-text-2">
                        {a.actor ?? <span className="text-text-4 italic">system</span>}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[9px] text-text-4">
                        {a.enrollment_id?.slice(0, 8) ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {pagination.pageRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3.5 py-8 text-center text-[11px] text-text-3">
                        No audit entries match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
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
