import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { Plus, MoreVertical, ArrowLeft, Download } from "lucide-react";
import {
  fetchSubPillarById,
  fetchWeeklyArticlesBySubPillarId,
  createWeeklyArticle,
} from "@/lib/db/ministry/yfp";
import {
  RecordFormDialog,
  type FieldDef,
} from "@/components/admin/composables/forms/record-form-dialog";
import { Icon } from "@iconify/react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/formation/yfp/sub-pillars/$subPillarId/articles")({
  component: YFPWeeklyArticles,
});

const ARTICLE_FORM_FIELDS: FieldDef[] = [
  {
    key: "article_title",
    label: "Article Title",
    required: true,
    placeholder: "e.g. Article 1: As young people, we believe in one God",
  },
  {
    key: "week_number",
    label: "Week Number",
    type: "number",
    required: true,
    placeholder: "e.g. 1",
  },
  {
    key: "sunday_date",
    label: "Sunday Date",
    type: "date",
    required: true,
  },
  {
    key: "liturgical_calendar_title",
    label: "Liturgical Calendar Title",
    placeholder: "e.g. 1st Sunday after Epiphany",
  },
  {
    key: "scripture_citations",
    label: "Scripture References",
    placeholder: "Isaiah 44:6, Deuteronomy 6:4-5 (comma-separated)",
  },
];

function YFPWeeklyArticles() {
  const { subPillarId } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: subPillar } = useQuery({
    queryKey: ["yfp-sub-pillar", subPillarId],
    queryFn: () => fetchSubPillarById(subPillarId),
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["yfp-weekly-articles", subPillarId],
    queryFn: () => fetchWeeklyArticlesBySubPillarId(subPillarId),
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      return createWeeklyArticle({
        pillar_id: subPillar?.pillar_id || "",
        sub_pillar_id: subPillarId,
        article_title: values.article_title,
        week_number: parseInt(values.week_number),
        sunday_date: values.sunday_date,
        liturgical_year: new Date().getFullYear(),
        month: new Date(values.sunday_date).toLocaleString("default", {
          month: "long",
        }),
        liturgical_calendar_title: values.liturgical_calendar_title || undefined,
        scripture_citations: values.scripture_citations
          ? values.scripture_citations
              .split(",")
              .map((s: string) => ({ reference: s.trim(), text: "" }))
          : [],
        status: "Draft",
      });
    },
    onSuccess: () => {
      toast.success("Article created successfully");
      qc.invalidateQueries({ queryKey: ["yfp-weekly-articles", subPillarId] });
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create article");
    },
  });

  const filteredArticles = useMemo(() => {
    if (filterStatus === "all") return articles;
    return articles.filter((a) => a.status === filterStatus);
  }, [articles, filterStatus]);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="space-y-3 px-6 py-4">
        {/* Header with Back Button */}
        <button
          onClick={() => {
            if (subPillar?.pillar_id) {
              navigate({
                to: "/admin/formation/yfp/pillars/$pillarId/sub-pillars",
                params: { pillarId: subPillar.pillar_id },
              });
            }
          }}
          className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sub-Pillars
        </button>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {subPillar?.title}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{subPillar?.title} - Weekly Content</h1>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase text-slate-500">Articles</div>
            <div className="text-2xl font-black text-[#881337]">{articles.length}</div>
          </div>
        </div>

        {/* Action Buttons & Filters */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#881337] px-4 py-2 text-sm font-bold text-white hover:bg-[#991b1b]"
          >
            <Plus className="h-4 w-4" />
            Add Article
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" />
            Download
          </button>

          {/* Status Filter */}
          <div className="ml-auto flex gap-2">
            {["all", "Published", "Scheduled", "Draft"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  filterStatus === status
                    ? "bg-[#881337] text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {status === "all" ? "All" : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Articles Table */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200/70 bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
                  Week & Title
                </th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
                  Sunday Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
                  Status
                </th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-600">
                    No articles found. Create one to get started.
                  </td>
                </tr>
              ) : (
                filteredArticles.map((article) => (
                  <tr key={article.id} className="border-b border-slate-200/70 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon icon="mdi:book" className="h-4 w-4 text-slate-500" />
                          <span className="font-semibold text-slate-900">
                            Week {article.week_number}: {article.article_title}
                          </span>
                        </div>
                        {article.scripture_citations &&
                          (article.scripture_citations as any[]).length > 0 && (
                            <div className="text-xs text-slate-600">
                              📖{" "}
                              {(article.scripture_citations as any[])
                                .map((c: any) => c.reference)
                                .join(", ")}
                            </div>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {new Date(article.sunday_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-bold ${
                          article.status === "Published"
                            ? "bg-green-100 text-green-700"
                            : article.status === "Scheduled"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        • {article.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() =>
                            setActionMenuOpen(actionMenuOpen === article.id ? null : article.id)
                          }
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        {actionMenuOpen === article.id && (
                          <div className="absolute right-0 top-6 z-10 rounded-lg border border-slate-200 bg-white shadow-md">
                            <button className="block w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">
                              View Details
                            </button>
                            <button className="block w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">
                              Edit
                            </button>
                            <button className="block w-full px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50">
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Article Dialog */}
      <RecordFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Add Weekly Article"
        description={`Add a formation article to ${subPillar?.title}`}
        fields={ARTICLE_FORM_FIELDS}
        submitLabel="Create Article"
        onSubmit={(values) => createMut.mutate(values)}
      />
    </div>
  );
}
