import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Plus, MoreVertical, Download, Edit2, Check, X, Trash2 } from "lucide-react";
import {
  fetchSubPillarById,
  fetchWeeklyArticlesBySubPillarId,
  createWeeklyArticle,
  updateWeeklyArticle,
  deleteWeeklyArticle,
} from "@/lib/db/ministry/yfp";
import { supabase } from "@/integrations/supabase/client";
import { Topbar } from "@/components/admin/layout/topbar";
import {
  RecordFormDialog,
  type FieldDef,
} from "@/components/admin/composables/forms/record-form-dialog";
import {
  DateRangeFilter,
  type DateRange,
} from "@/components/admin/composables/pickers/date-range-filter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  {
    key: "handbook_page_reference",
    label: "Handbook Page Reference",
    placeholder: "e.g. Page 42-45",
  },
  {
    key: "guided_reflection_questions",
    label: "Reflection Questions",
    type: "textarea",
    placeholder: "Enter reflection questions (one per line)",
  },
  {
    key: "pastoral_directive",
    label: "Pastoral Directive",
    type: "textarea",
    placeholder: "Guidance for pastoral leaders",
  },
  {
    key: "materials",
    label: "Materials (Images & PDFs)",
    type: "file",
    accept: "image/*,.pdf",
    bucket: "formation",
    maxSizeMb: 20,
  },
];

function YFPWeeklyArticles() {
  const { subPillarId } = useParams({ from: Route.id });
  const qc = useQueryClient();

  const { data: subPillar } = useQuery({
    queryKey: ["yfp-sub-pillar", subPillarId],
    queryFn: () => fetchSubPillarById(subPillarId),
  });

  const { data: allArticles = [] } = useQuery({
    queryKey: ["yfp-weekly-articles", subPillarId],
    queryFn: () => fetchWeeklyArticlesBySubPillarId(subPillarId),
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [isEditingPanel, setIsEditingPanel] = useState(false);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<{ type: "publish" | "schedule" | "delete"; articleId: string } | null>(null);
  const [articleMaterials, setArticleMaterials] = useState<Array<{ url: string; name: string; type: "image" | "pdf"; uploadedAt: string }>>([]);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  const filteredArticles = useMemo(() => {
    let filtered = allArticles;

    if (filterStatus !== "all") {
      filtered = filtered.filter((a) => a.status === filterStatus);
    }

    if (dateRange.from) {
      filtered = filtered.filter((a) => new Date(a.sunday_date) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter((a) => new Date(a.sunday_date) <= dateRange.to!);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => {
        const titleMatch = a.article_title?.toLowerCase().includes(query) || false;
        const liturgicalMatch = a.liturgical_calendar_title?.toLowerCase().includes(query) || false;
        const scriptureMatch = a.scripture_citations?.some((s: any) =>
          s.reference?.toLowerCase().includes(query)
        ) || false;
        const handbookMatch = a.handbook_page_reference?.toLowerCase().includes(query) || false;
        const reflectionMatch = a.guided_reflection_questions?.some((q: string) =>
          q.toLowerCase().includes(query)
        ) || false;
        const directiveMatch = a.pastoral_directive?.toLowerCase().includes(query) || false;
        const materialMatch = a.materials?.some((m: any) =>
          m.name?.toLowerCase().includes(query)
        ) || false;

        return titleMatch || liturgicalMatch || scriptureMatch || handbookMatch || reflectionMatch || directiveMatch || materialMatch;
      });
    }

    return filtered;
  }, [allArticles, filterStatus, dateRange, searchQuery]);

  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedArticles = filteredArticles.slice(startIdx, startIdx + itemsPerPage);

  const createMut = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      return createWeeklyArticle({
        pillar_id: subPillar?.pillar_id || "",
        sub_pillar_id: subPillarId,
        article_title: values.article_title,
        week_number: parseInt(values.week_number),
        sunday_date: values.sunday_date,
        liturgical_year: new Date().getFullYear(),
        month: new Date(values.sunday_date).toLocaleString("default", { month: "long" }),
        liturgical_calendar_title: values.liturgical_calendar_title || undefined,
        scripture_citations: values.scripture_citations
          ? values.scripture_citations.split(",").map((s: string) => ({ reference: s.trim(), text: "" }))
          : [],
        handbook_page_reference: values.handbook_page_reference || undefined,
        guided_reflection_questions: values.guided_reflection_questions
          ? values.guided_reflection_questions.split("\n").map((q: string) => q.trim()).filter(Boolean)
          : [],
        pastoral_directive: values.pastoral_directive || undefined,
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

  const updateMut = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      if (!selectedArticle) return;
      return updateWeeklyArticle(selectedArticle.id, {
        article_title: values.article_title,
        week_number: parseInt(values.week_number),
        sunday_date: values.sunday_date,
        liturgical_calendar_title: values.liturgical_calendar_title || undefined,
        scripture_citations: values.scripture_citations
          ? values.scripture_citations.split(",").map((s: string) => ({ reference: s.trim(), text: "" }))
          : [],
        handbook_page_reference: values.handbook_page_reference || undefined,
        guided_reflection_questions: values.guided_reflection_questions
          ? values.guided_reflection_questions.split("\n").map((q: string) => q.trim()).filter(Boolean)
          : [],
        pastoral_directive: values.pastoral_directive || undefined,
        materials: articleMaterials,
      });
    },
    onSuccess: () => {
      toast.success("Article updated successfully");
      qc.invalidateQueries({ queryKey: ["yfp-weekly-articles", subPillarId] });
      setIsEditingPanel(false);
      setSelectedArticle(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update article");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      return deleteWeeklyArticle(id);
    },
    onSuccess: () => {
      toast.success("Article deleted successfully");
      qc.invalidateQueries({ queryKey: ["yfp-weekly-articles", subPillarId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete article");
    },
  });

  const publishMut = useMutation({
    mutationFn: async (articleId: string) => {
      return updateWeeklyArticle(articleId, {
        status: "Published",
        published_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success("Article published successfully");
      qc.invalidateQueries({ queryKey: ["yfp-weekly-articles", subPillarId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to publish article");
    },
  });

  const scheduleMut = useMutation({
    mutationFn: async (articleId: string) => {
      return updateWeeklyArticle(articleId, { status: "Scheduled" });
    },
    onSuccess: () => {
      toast.success("Article scheduled successfully");
      qc.invalidateQueries({ queryKey: ["yfp-weekly-articles", subPillarId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to schedule article");
    },
  });

  const handleMaterialUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20 MB");
      return;
    }

    setUploadingMaterial(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("formation")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });

      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("formation").getPublicUrl(path);
      const isImage = file.type.startsWith("image/");
      setArticleMaterials([
        ...articleMaterials,
        { url: data.publicUrl, name: file.name, type: isImage ? "image" : "pdf", uploadedAt: new Date().toISOString() },
      ]);
      toast.success(`${file.name} uploaded successfully`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleEditStart = () => {
    if (!selectedArticle) return;
    setEditingValues({
      article_title: selectedArticle.article_title,
      week_number: selectedArticle.week_number.toString(),
      sunday_date: selectedArticle.sunday_date,
      liturgical_calendar_title: selectedArticle.liturgical_calendar_title || "",
      scripture_citations: selectedArticle.scripture_citations?.map((s: any) => s.reference).join(", ") || "",
      handbook_page_reference: selectedArticle.handbook_page_reference || "",
      guided_reflection_questions: selectedArticle.guided_reflection_questions?.join("\n") || "",
      pastoral_directive: selectedArticle.pastoral_directive || "",
    });
    setArticleMaterials(selectedArticle.materials || []);
    setIsEditingPanel(true);
  };

  const handleSaveEdit = () => {
    updateMut.mutate(editingValues);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar
        title={`${subPillar?.title} - Weekly Content`}
        description="Formation — Weekly Articles"
        action={
          <div className="flex items-center gap-3">
            <button onClick={() => setCreateDialogOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              <Plus className="h-4 w-4" />
              Add Article
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        }
      />

      {/* Split Layout */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left: Table - 50% */}
        <div className="w-1/2 h-full flex flex-col border-r border-slate-200">
          {/* Filters Bar */}
          <div className="border-b border-slate-200 bg-white px-6 py-3 flex items-center gap-3 flex-shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs w-56 focus:border-gold-3 focus:text-black outline-none"
              placeholder="Search by title..."
            />

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:border-gold-3 focus:text-black outline-none"
            >
              <option value="all">All</option>
              <option value="Published">Published</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Draft">Draft</option>
            </select>

            <DateRangeFilter
              value={dateRange}
              onChange={(range) => {
                setDateRange(range);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm">
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
                    {paginatedArticles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-600">
                          No articles found.
                        </td>
                      </tr>
                    ) : (
                      paginatedArticles.map((article) => (
                        <tr
                          key={article.id}
                          className={`border-b border-slate-200/70 cursor-pointer ${
                            selectedArticle?.id === article.id ? "bg-blue-50" : "hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setSelectedArticle(article);
                            setIsEditingPanel(false);
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Icon icon="mdi:book" className="h-4 w-4 text-slate-500" />
                                <span className="font-semibold text-slate-900">
                                  Week {article.week_number}: {article.article_title}
                                </span>
                              </div>
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
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="text-slate-400 hover:text-slate-600">
                                  <MoreVertical className="h-5 w-5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setConfirmAction({ type: "publish", articleId: article.id });
                                  }}
                                  disabled={article.status === "Published"}
                                >
                                  Publish
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setConfirmAction({ type: "schedule", articleId: article.id });
                                  }}
                                  disabled={article.status === "Scheduled"}
                                >
                                  Schedule
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedArticle(article);
                                    handleEditStart();
                                  }}
                                >
                                  <Edit2 className="mr-2 h-3.5 w-3.5" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setConfirmAction({ type: "delete", articleId: article.id });
                                  }}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-xs">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:border-gold-3 focus:text-black outline-none"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
              <div className="text-slate-600">
                <span className="font-semibold">
                  {paginatedArticles.length > 0 ? startIdx + 1 : 0}-{Math.min(startIdx + itemsPerPage, filteredArticles.length)}
                </span>
                <span> of {filteredArticles.length} articles</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded px-3 py-1 text-xs font-bold disabled:opacity-50 border border-slate-200 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded px-3 py-1 text-xs font-bold disabled:opacity-50 border border-slate-200 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Detail Panel - 50% */}
        {selectedArticle && (
          <div className="w-1/2 h-full border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b border-slate-200 bg-white p-3 flex items-start justify-between flex-shrink-0">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {new Date(selectedArticle.sunday_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <h2 className="text-lg font-black text-slate-900 mt-1">
                  Week {selectedArticle.week_number}: {selectedArticle.article_title}
                </h2>
              </div>
              {isEditingPanel ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 rounded-lg bg-danger px-3 py-2 text-xs font-bold text-white hover:opacity-90"
                  >
                    <Check className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingPanel(false)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleEditStart}
                  className="flex items-center gap-2 rounded-lg bg-danger px-3 py-2 text-xs font-bold text-white hover:opacity-90"
                >
                  <Edit2 className="h-3 w-3" />
                  Edit
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {isEditingPanel ? (
                <div className="space-y-3">
                  {ARTICLE_FORM_FIELDS.map((field) => (
                    <div key={field.key} className="border-l-4 border-amber-400 bg-white rounded p-3 pl-3">
                      <label className="text-xs font-bold uppercase text-slate-600 block mb-1">{field.label}</label>
                      {field.type === "textarea" ? (
                        <textarea
                          value={editingValues[field.key] || ""}
                          onChange={(e) => setEditingValues({ ...editingValues, [field.key]: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs mt-1 resize-both min-h-24 focus:border-gold-3 focus:text-black outline-none"
                          placeholder={field.placeholder}
                        />
                      ) : field.type === "number" ? (
                        <input
                          type="number"
                          value={editingValues[field.key] || ""}
                          onChange={(e) => setEditingValues({ ...editingValues, [field.key]: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs mt-1 focus:border-gold-3 focus:text-black outline-none"
                        />
                      ) : field.type === "date" ? (
                        <input
                          type="date"
                          value={editingValues[field.key] || ""}
                          onChange={(e) => setEditingValues({ ...editingValues, [field.key]: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs mt-1 focus:border-gold-3 focus:text-black outline-none"
                        />
                      ) : field.type === "file" ? (
                        <div className="space-y-2">
                          <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">
                            <Icon icon={uploadingMaterial ? "mdi:loading" : "mdi:upload"} className={uploadingMaterial ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                            {uploadingMaterial ? "Uploading…" : "Choose file"}
                            <input
                              type="file"
                              accept={field.accept}
                              onChange={(e) => handleMaterialUpload(e.target.files)}
                              disabled={uploadingMaterial}
                              className="hidden"
                            />
                          </label>
                          {articleMaterials.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {articleMaterials.map((material, idx) => (
                                <div key={idx} className="border border-slate-200 rounded p-2 flex items-center justify-between text-xs">
                                  <span className="truncate">{material.name}</span>
                                  <button
                                    onClick={() => {
                                      const updated = articleMaterials.filter((_, i) => i !== idx);
                                      setArticleMaterials(updated);
                                    }}
                                    className="text-red-600 ml-2"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={editingValues[field.key] || ""}
                          onChange={(e) => setEditingValues({ ...editingValues, [field.key]: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs mt-1 focus:border-gold-3 focus:text-black outline-none"
                          placeholder={field.placeholder}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Scripture Section */}
                  <div className="border-l-4 border-slate-400 bg-white rounded p-4">
                    <h3 className="text-xs font-bold uppercase text-slate-700 mb-3">
                      Scripture & Manual Reference
                    </h3>
                    {selectedArticle.scripture_citations && selectedArticle.scripture_citations.length > 0 ? (
                      <div className="space-y-1">
                        {selectedArticle.scripture_citations.map((s: any) => (
                          <p key={s.reference} className="text-sm text-slate-900">
                            {s.reference}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No scripture references</p>
                    )}
                    {selectedArticle.handbook_page_reference && (
                      <p className="text-xs text-slate-600 mt-2 pt-2 border-t">
                        <strong>ACC Manual:</strong> {selectedArticle.handbook_page_reference}
                      </p>
                    )}
                  </div>

                  {/* Reflection Questions Section */}
                  <div className="bg-white rounded p-4">
                    <h3 className="text-xs font-bold uppercase text-slate-700 mb-3">
                      Reflection Questions
                    </h3>
                    {selectedArticle.guided_reflection_questions && selectedArticle.guided_reflection_questions.length > 0 ? (
                      <div className="space-y-3">
                        {selectedArticle.guided_reflection_questions.map((q: string, idx: number) => (
                          <div key={idx} className="flex gap-3">
                            <div className="h-6 w-6 min-w-6 rounded-full bg-slate-400 flex items-center justify-center text-xs font-bold text-white">
                              {idx + 1}
                            </div>
                            <p className="text-sm text-slate-700 pt-1">{q}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No reflection questions</p>
                    )}
                  </div>

                  {/* Pastoral Directive Section */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">
                      Pastoral Directive
                    </h3>
                    {selectedArticle.pastoral_directive ? (
                      <p className="text-sm text-slate-700">{selectedArticle.pastoral_directive}</p>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No pastoral directive</p>
                    )}
                  </div>

                  {/* Materials Section */}
                  <div className="bg-white rounded p-4">
                    <h3 className="text-xs font-bold uppercase text-slate-700 mb-3">
                      Materials
                    </h3>
                    {articleMaterials.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {articleMaterials.map((material, idx) => (
                          <div key={idx} className="border border-slate-200 rounded p-2 text-xs text-slate-900 truncate">
                            {material.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No materials uploaded yet</p>
                    )}
                  </div>

                  {/* Status Section */}
                  <div className="bg-white rounded p-4 border-b">
                    <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">Status</h3>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                        selectedArticle.status === "Published"
                          ? "bg-green-100 text-green-700"
                          : selectedArticle.status === "Scheduled"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      • {selectedArticle.status}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer spacer */}
            <div className="h-12 flex-shrink-0" />
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirmAction?.type === "publish" && "Publish Article?"}
            {confirmAction?.type === "schedule" && "Schedule Article?"}
            {confirmAction?.type === "delete" && "Delete Article?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmAction?.type === "publish" && "This article will be published and visible to users."}
            {confirmAction?.type === "schedule" && "This article will be scheduled for later."}
            {confirmAction?.type === "delete" && "This article will be permanently deleted. This action cannot be undone."}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "publish") publishMut.mutate(confirmAction.articleId);
                else if (confirmAction.type === "schedule") scheduleMut.mutate(confirmAction.articleId);
                else if (confirmAction.type === "delete") deleteMut.mutate(confirmAction.articleId);
                setConfirmAction(null);
              }}
              className={confirmAction?.type === "delete" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {confirmAction?.type === "delete" ? "Delete" : "Confirm"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

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
