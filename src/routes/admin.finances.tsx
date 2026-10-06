import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchOrg, type OrgTree } from "@/lib/db/org";
import { useAdminScope } from "@/lib/hooks/use-admin-scope";
import {
  listFinancialCategories,
  createParishPayment,
  listParishAssessmentsPaged,
  type ParishAssessment,
} from "@/lib/db/finances";
import { Topbar, TopbarTab } from "@/components/admin/layout/topbar";
import { Card, CardBody } from "@/components/admin/composables/ui-bits";
import { Icon } from "@iconify/react";
import {
  RecordPaymentDialog,
  type RecordPaymentInput,
} from "@/components/admin/composables/forms/record-payment-dialog";

const financesSearchSchema = z.object({
  tab: fallback(z.enum(["summary", "events", "projects", "enrollment"]), "summary"),
  fiscal_year: fallback(z.number().int().min(2020).max(2100), new Date().getFullYear()),
  deanery_id: fallback(z.string(), ""),
});

type FinancesSearch = z.infer<typeof financesSearchSchema>;

export const Route = createFileRoute("/admin/finances")({
  validateSearch: zodValidator(financesSearchSchema),
  head: () => ({
    meta: [
      { title: "Finance & Ledger — CDM Youth Office" },
      {
        name: "description",
        content: "Centralized financial management and parish payment tracking.",
      },
    ],
  }),
  component: FinancesPage,
});

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

function FinancesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const scope = useAdminScope();
  const qc = useQueryClient();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const setTab = (tab: string) => {
    navigate({ search: (prev: FinancesSearch) => ({ ...prev, tab: tab as any }) });
  };

  const setYear = (year: number) => {
    navigate({ search: (prev: FinancesSearch) => ({ ...prev, fiscal_year: year }) });
  };

  const deaneryId = scope.deaneryId || search.deanery_id;

  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const { data: categories = [] } = useQuery<import("@/lib/db/finances").FinancialCategory[]>({
    queryKey: ["financial-categories"],
    queryFn: listFinancialCategories,
  });

  // Fetch assessments for payment modal
  const { data: assessmentsResp } = useQuery({
    queryKey: ["parish-assessments", search.fiscal_year],
    queryFn: () =>
      listParishAssessmentsPaged({
        fiscalYear: search.fiscal_year,
        page: 0,
        size: 1000, // Load all for modal use
      }),
  });
  const assessments = assessmentsResp?.data ?? [];

  const paymentMut = useMutation({
    mutationFn: (input: RecordPaymentInput) => createParishPayment(input),
    onSuccess: () => {
      toast.success("Payment recorded");
      setPaymentModalOpen(false);
      qc.invalidateQueries({ queryKey: ["parish-assessments"] });
      qc.invalidateQueries({ queryKey: ["parish-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Deanery options for filtering
  const deaneryOptions = (org?.deaneries ?? []).map((d) => ({ value: d.id, label: d.name }));

  return (
    <>
      <Topbar
        title="Finance & Ledger"
        description="Centralized financial management for deaneries and parishes."
        tabs={
          <>
            <TopbarTab active={search.tab === "summary"} onClick={() => setTab("summary")}>
              Summary
            </TopbarTab>
            <TopbarTab active={search.tab === "events"} onClick={() => setTab("events")}>
              Events
            </TopbarTab>
            <TopbarTab active={search.tab === "projects"} onClick={() => setTab("projects")}>
              Projects
            </TopbarTab>
            <TopbarTab active={search.tab === "enrollment"} onClick={() => setTab("enrollment")}>
              Enrollment
            </TopbarTab>
          </>
        }
        action={
          <button
            type="button"
            onClick={() => setPaymentModalOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[11px] font-bold text-white transition hover:opacity-90"
          >
            <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> Record Payment
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          {/* Toolbar with filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-3.5 py-2.5">
            <div className="flex items-center gap-3">
              {deaneryOptions.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-text-3">Deanery:</label>
                  <select
                    value={deaneryId}
                    onChange={(e) =>
                      navigate({
                        search: (prev: FinancesSearch) => ({
                          ...prev,
                          deanery_id: e.target.value,
                        }),
                      })
                    }
                    className="h-8 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 outline-none transition hover:border-gold-3 focus:border-gold-3"
                  >
                    <option value="">All Deaneries</option>
                    {deaneryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {search.tab === "events" && (
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-text-3">Fiscal Year:</label>
                  <select
                    value={search.fiscal_year}
                    onChange={(e) => setYear(parseInt(e.target.value, 10))}
                    className="h-8 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 outline-none transition hover:border-gold-3 focus:border-gold-3"
                  >
                    {YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <CardBody className="p-0">
            {search.tab === "summary" && (
              <DeanerySummaryTab org={org} deaneryId={deaneryId} categories={categories} />
            )}
            {search.tab === "events" && (
              <EventsTab
                org={org}
                deaneryId={deaneryId}
                fiscalYear={search.fiscal_year}
                categories={categories}
              />
            )}
            {search.tab === "projects" && (
              <ProjectsTab org={org} deaneryId={deaneryId} categories={categories} />
            )}
            {search.tab === "enrollment" && (
              <EnrollmentTab org={org} deaneryId={deaneryId} categories={categories} />
            )}
          </CardBody>
        </Card>
      </div>

      <RecordPaymentDialog
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        org={org}
        assessments={assessments}
        isPending={paymentMut.isPending}
        onSubmit={(input) => paymentMut.mutate(input)}
      />
    </>
  );
}

// ============ TAB COMPONENTS ============

function DeanerySummaryTab({
  org,
  deaneryId,
  categories,
}: {
  org?: OrgTree;
  deaneryId: string;
  categories: import("@/lib/db/finances").FinancialCategory[];
}) {
  const { data: summaryData } = useQuery({
    queryKey: ["finance-summary", CURRENT_YEAR, deaneryId],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: CURRENT_YEAR.toString(),
      });
      if (deaneryId) params.append("deaneryId", deaneryId);

      const resp = await fetch(`/api/finances/summary?${params}`);
      if (!resp.ok) throw new Error("Failed to fetch summary");
      return resp.json();
    },
  });

  const summaries = summaryData?.summaries ?? [];

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-border">
          <th className="label-eyebrow px-3.5 py-2.5 text-left">Deanery / Parish</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Total Events Arrears</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Total Project Balance</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Enrollment Arrears</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Net Composite Position</th>
        </tr>
      </thead>
      <tbody>
        {deaneryId
          ? // Show parishes for selected deanery
            summaries[0]?.parishes?.map((parish: any) => (
              <tr key={parish.id} className="border-b border-border/30 hover:bg-bg-3">
                <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                  {parish.name}
                </td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-danger font-semibold">
                  KES {(parish.currentArrears ?? 0).toLocaleString()}
                </td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-foreground">KES 0</td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-danger font-semibold">
                  KES 0
                </td>
                <td className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-success">
                  KES {(parish.totalBalance ?? 0).toLocaleString()}
                </td>
              </tr>
            ))
          : // Show deaneries
            summaries.map((deanery: any) => (
              <tr key={deanery.id} className="border-b border-border/30 hover:bg-bg-3">
                <td className="px-3.5 py-2.5 text-[11px] font-bold text-foreground">
                  {deanery.name}
                </td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-danger font-semibold">
                  KES {(deanery.currentArrears ?? 0).toLocaleString()}
                </td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-foreground">KES 0</td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-danger font-semibold">
                  KES 0
                </td>
                <td className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-success">
                  KES {(deanery.totalBalance ?? 0).toLocaleString()}
                </td>
              </tr>
            ))}
      </tbody>
    </table>
  );
}

function EventsTab({
  org,
  deaneryId,
  fiscalYear,
  categories,
}: {
  org?: OrgTree;
  deaneryId: string;
  fiscalYear: number;
  categories: import("@/lib/db/finances").FinancialCategory[];
}) {
  // Load aggregated events summary in ONE query
  const { data: summaryData } = useQuery({
    queryKey: ["finance-events-summary", fiscalYear, deaneryId],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: fiscalYear.toString(),
      });
      if (deaneryId) params.append("deaneryId", deaneryId);

      const resp = await fetch(`/api/finances/events-summary?${params}`);
      if (!resp.ok) throw new Error("Failed to fetch events summary");
      return resp.json();
    },
  });

  const summaries = summaryData?.summaries ?? [];

  // Get unique event categories from all summaries
  const eventMap = new Map<string, any>();
  summaries.forEach((summary: any) => {
    summary.events?.forEach((event: any) => {
      if (!eventMap.has(event.id)) {
        eventMap.set(event.id, event);
      }
    });
  });
  const eventCategories = Array.from(eventMap.values());

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="label-eyebrow px-3.5 py-2.5 text-left">Deanery / Parish</th>
            {eventCategories.map((event: any) => (
              <th
                key={event.id}
                className="label-eyebrow px-3.5 py-2.5 text-right whitespace-nowrap text-[10px]"
              >
                <div className="font-bold">{event.name}</div>
                <div className="text-[9px] font-semibold text-text-3">
                  ({event.amountDue.toLocaleString()})
                </div>
              </th>
            ))}
            <th className="label-eyebrow px-3.5 py-2.5 text-right">Current Arrears</th>
            <th className="label-eyebrow px-3.5 py-2.5 text-right">Previous Arrears</th>
            <th className="label-eyebrow px-3.5 py-2.5 text-right">Total Balance</th>
          </tr>
        </thead>
        <tbody>
          {deaneryId
            ? // Show parishes for selected deanery
              summaries[0]?.parishes?.map((parish: any) => (
                <tr key={parish.id} className="border-b border-border/30 hover:bg-bg-3">
                  <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                    {parish.name}
                  </td>
                  {parish.events?.map((event: any) => (
                    <td
                      key={event.id}
                      className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-foreground"
                    >
                      KES {event.amountDue.toLocaleString()}
                    </td>
                  ))}
                  <td className="px-3.5 py-2.5 text-right text-[11px] text-danger font-semibold">
                    KES {(parish.currentArrears ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] text-text-3">
                    KES {(parish.previousArrears ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-success">
                    KES {(parish.totalBalance ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))
            : // Show deaneries
              summaries.map((deanery: any) => (
                <tr key={deanery.id} className="border-b border-border/30 hover:bg-bg-3">
                  <td className="px-3.5 py-2.5 text-[11px] font-bold text-foreground">
                    {deanery.name}
                  </td>
                  {deanery.events?.map((event: any) => (
                    <td
                      key={event.id}
                      className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-foreground"
                    >
                      KES {event.amountDue.toLocaleString()}
                    </td>
                  ))}
                  <td className="px-3.5 py-2.5 text-right text-[11px] text-danger font-semibold">
                    KES {(deanery.currentArrears ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] text-text-3">
                    KES {(deanery.previousArrears ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-success">
                    KES {(deanery.totalBalance ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectsTab({
  org,
  deaneryId,
  categories,
}: {
  org?: OrgTree;
  deaneryId: string;
  categories: import("@/lib/db/finances").FinancialCategory[];
}) {
  const projectCategories = categories.filter((c) => c.type === "project");

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-border">
          <th className="label-eyebrow px-3.5 py-2.5 text-left">Deanery / Parish</th>
          {projectCategories.map((cat) => (
            <th key={cat.id} className="label-eyebrow px-3.5 py-2.5 text-right whitespace-nowrap">
              {cat.name}
            </th>
          ))}
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Previous Debt</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Allocation</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Special Collections</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Payments</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Balance</th>
        </tr>
      </thead>
      <tbody>
        {deaneryId
          ? (org?.parishes ?? [])
              .filter((p) => p.deanery_id === deaneryId)
              .map((parish) => (
                <tr key={parish.id} className="border-b border-border/30 hover:bg-bg-3">
                  <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                    {parish.name}
                  </td>
                  {projectCategories.map((cat) => (
                    <td
                      key={cat.id}
                      className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-foreground"
                    >
                      KES 0
                    </td>
                  ))}
                  <td className="px-3.5 py-2.5 text-right text-[11px] text-text-3">KES 0</td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] text-foreground">KES 0</td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] text-foreground">KES 0</td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-success">
                    KES 0
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-success">
                    KES 0
                  </td>
                </tr>
              ))
          : (org?.deaneries ?? []).map((deanery) => (
              <tr key={deanery.id} className="border-b border-border/30 hover:bg-bg-3">
                <td className="px-3.5 py-2.5 text-[11px] font-bold text-foreground">
                  {deanery.name}
                </td>
                {projectCategories.map((cat) => (
                  <th
                    key={cat.id}
                    className="label-eyebrow px-3.5 py-2.5 text-right text-[11px] font-semibold"
                  >
                    KES 0
                  </th>
                ))}
                <td className="px-3.5 py-2.5 text-right text-[11px] text-text-3">KES 0</td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-foreground">KES 0</td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-foreground">KES 0</td>
                <td className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-success">
                  KES 0
                </td>
                <td className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-success">
                  KES 0
                </td>
              </tr>
            ))}
      </tbody>
    </table>
  );
}

function EnrollmentTab({
  org,
  deaneryId,
  categories,
}: {
  org?: OrgTree;
  deaneryId: string;
  categories: import("@/lib/db/finances").FinancialCategory[];
}) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-border">
          <th className="label-eyebrow px-3.5 py-2.5 text-left">Deanery / Parish</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Enrolled Youths</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Rate (KES)</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Total Due</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Total Paid</th>
          <th className="label-eyebrow px-3.5 py-2.5 text-right">Subscription Arrears</th>
        </tr>
      </thead>
      <tbody>
        {deaneryId
          ? (org?.parishes ?? [])
              .filter((p) => p.deanery_id === deaneryId)
              .map((parish) => (
                <tr key={parish.id} className="border-b border-border/30 hover:bg-bg-3">
                  <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                    {parish.name}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] text-foreground">0</td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] font-mono text-text-2">
                    100
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] text-foreground">KES 0</td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-success">
                    KES 0
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[11px] text-danger font-semibold">
                    KES 0
                  </td>
                </tr>
              ))
          : (org?.deaneries ?? []).map((deanery) => (
              <tr key={deanery.id} className="border-b border-border/30 hover:bg-bg-3">
                <td className="px-3.5 py-2.5 text-[11px] font-bold text-foreground">
                  {deanery.name}
                </td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-foreground">0</td>
                <td className="px-3.5 py-2.5 text-right text-[11px] font-mono text-text-2">100</td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-foreground">KES 0</td>
                <td className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-success">
                  KES 0
                </td>
                <td className="px-3.5 py-2.5 text-right text-[11px] text-danger font-semibold">
                  KES 0
                </td>
              </tr>
            ))}
      </tbody>
    </table>
  );
}

