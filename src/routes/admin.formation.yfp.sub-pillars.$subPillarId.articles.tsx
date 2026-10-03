import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Plus, MoreVertical, Download, Edit2, Trash2, Check } from "lucide-react";
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
  ColumnFilter,
  ColumnHeader,
  TableToolbar,
  type ColumnFilterValue,
} from "@/components/admin/composables/tables/table-filters";
import {
  TablePagination,
  useServerPagination,
} from "@/components/admin/composables/tables/table-pagination";
import { Card, CardBody, Pill } from "@/components/admin/composables/ui-bits";
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
  const pagination = useServerPagination(5);

  const { data: subPillar } = useQuery({
    queryKey: ["yfp-sub-pillar", subPillarId],
    queryFn: () => fetchSubPillarById(subPillarId),
  });

  const { data: allArticles = [] } = useQuery({
    queryKey: ["yfp-weekly-articles", subPillarId],
    queryFn: () => fetchWeeklyArticlesBySubPillarId(subPillarId),
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [articleMaterials, setArticleMaterials] = useState<Array<{ url: string; name: string; type: "image" | "pdf"; uploadedAt: string }>>([]);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "publish" | "schedule" | "delete"; articleId: string } | null>(null);

  const filteredArticles = useMemo(() => {
    let filtered = allArticles;

    if (filterStatus) {
      filtered = filtered.filter((a) => a.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((a) =>
        a.article_title?.toLowerCase().includes(query) ||
        a.liturgical_calendar_title?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => a.week_number - b.week_number);
  }, [allArticles, filterStatus, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / pagination.pageSize));
  const safePage = Math.min(pagination.page, totalPages);
  const paginatedArticles = filteredArticles.slice(
    (safePage - 1) * pagination.pageSize,
    safePage * pagination.pageSize
  );

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
      setEditDialogOpen(false);
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

  return (
    <>
      <Topbar
        title={`${subPillar?.title} - Weekly Content`}
        description="Formation — Weekly Articles"
        action={
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[11px] font-bold text-white transition hover:opacity-90"
          >
            <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> Add Article
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left: Table - 50% */}
        <div className="w-1/2 flex flex-col border-r border-border overflow-hidden">
          <div className="px-5 py-4 flex-1 overflow-y-auto">
            <Card>
          <TableToolbar
            searchValue={searchQuery}
            onSearchChange={(value) => {
              setSearchQuery(value);
              pagination.reset();
            }}
            searchPlaceholder="Search by title or calendar reference…"
          />

          <CardBody className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader
                      label="Week & Title"
                      filter={
                        <ColumnFilter
                          label="Status"
                          mode="select"
                          options={[
                            { value: "Published", label: "Published" },
                            { value: "Scheduled", label: "Scheduled" },
                            { value: "Draft", label: "Draft" },
                          ]}
                          value={
                            filterStatus ? { operator: "equals", value: filterStatus } : undefined
                          }
                          onChange={(v) => {
                            setFilterStatus(v?.value);
                            pagination.reset();
                          }}
                        />
                      }
                    />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Sunday Date" />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-left">
                    <ColumnHeader label="Status" />
                  </th>
                  <th className="label-eyebrow px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedArticles.map((article) => (
                  <tr
                    key={article.id}
                    onClick={() => {
                      setSelectedArticle(article);
                      setArticleMaterials(article.materials || []);
                    }}
                    className={`border-b border-border/30 last:border-0 cursor-pointer ${
                      selectedArticle?.id === article.id ? "bg-primary/10" : "hover:bg-bg-3"
                    }`}
                  >
                    <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                      <div>Week {article.week_number}: {article.article_title}</div>
                      {article.liturgical_calendar_title && (
                        <div className="text-[10px] text-text-3 mt-0.5">{article.liturgical_calendar_title}</div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-[11px] text-text-2">
                      {new Date(article.sunday_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Pill
                        tone={
                          article.status === "Published"
                            ? "success"
                            : article.status === "Scheduled"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {article.status}
                      </Pill>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-2 text-text-2 hover:border-gold-3 hover:text-gold"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedArticle(article);
                              setArticleMaterials(article.materials || []);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Edit2 className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          {article.status !== "Published" && (
                            <DropdownMenuItem
                              onClick={() =>
                                setConfirmAction({ type: "publish", articleId: article.id })
                              }
                            >
                              <Check className="mr-2 h-3.5 w-3.5" /> Publish
                            </DropdownMenuItem>
                          )}
                          {article.status !== "Scheduled" && (
                            <DropdownMenuItem
                              onClick={() =>
                                setConfirmAction({ type: "schedule", articleId: article.id })
                              }
                            >
                              Schedule
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-danger focus:text-danger"
                            onClick={() =>
                              setConfirmAction({ type: "delete", articleId: article.id })
                            }
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {paginatedArticles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3.5 py-6 text-center text-[12px] text-text-2">
                      No articles found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardBody>

          <TablePagination
            page={safePage}
            pageSize={pagination.pageSize}
            total={filteredArticles.length}
            totalPages={totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
            </Card>
          </div>
        </div>

        {/* Right: Detail Panel - 50% */}
        {selectedArticle && (
          <div className="w-1/2 flex flex-col border-l border-border bg-bg-2 overflow-hidden">
            <div className="border-b border-border bg-white px-5 py-3 flex items-start justify-between flex-shrink-0">
              <div>
                <div className="text-[10px] font-bold uppercase text-text-3">Week {selectedArticle.week_number}</div>
                <h2 className="text-[13px] font-bold text-text-1 mt-1">{selectedArticle.article_title}</h2>
              </div>
              <button
                onClick={() => setEditDialogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-bold text-white hover:opacity-90"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <div>
                <h3 className="text-[10px] font-bold uppercase text-text-2 mb-1">Title</h3>
                <p className="text-[11px] text-text-1">{selectedArticle.article_title}</p>
              </div>

              <div>
                <h3 className="text-[10px] font-bold uppercase text-text-2 mb-1">Sunday Date</h3>
                <p className="text-[11px] text-text-1">
                  {new Date(selectedArticle.sunday_date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              {selectedArticle.liturgical_calendar_title && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-text-2 mb-1">Liturgical Title</h3>
                  <p className="text-[11px] text-text-1">{selectedArticle.liturgical_calendar_title}</p>
                </div>
              )}

              <div>
                <h3 className="text-[10px] font-bold uppercase text-text-2 mb-1">Status</h3>
                <Pill tone={selectedArticle.status === "Published" ? "success" : selectedArticle.status === "Scheduled" ? "warning" : "neutral"}>
                  {selectedArticle.status}
                </Pill>
              </div>

              {selectedArticle.scripture_citations?.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-text-2 mb-1">Scripture</h3>
                  <ul className="text-[11px] text-text-1 space-y-1">
                    {selectedArticle.scripture_citations.map((s: any) => (
                      <li key={s.reference}>{s.reference}</li>
                    ))}
                  </ul>
                </div>
              )}

              {articleMaterials.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-text-2 mb-2">Materials</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {articleMaterials.map((material, idx) => (
                      <div key={idx} className="border border-border rounded p-2 text-[10px] text-text-1 truncate">
                        {material.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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

      {/* Edit Article Dialog */}
      <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogTitle>Edit Article</AlertDialogTitle>
          <div className="space-y-4 py-4">
            {ARTICLE_FORM_FIELDS.filter((f) => f.key !== "materials").map((field) => (
              <div key={field.key}>
                <label className="text-xs font-bold uppercase text-text-2 block mb-1">{field.label}</label>
                {field.type === "textarea" ? (
                  <textarea
                    value={selectedArticle?.[field.key] || ""}
                    onChange={(e) =>
                      setSelectedArticle({ ...selectedArticle, [field.key]: e.target.value })
                    }
                    className="w-full rounded border border-border bg-bg-3 px-2 py-1.5 text-[11px] resize-none min-h-20"
                    placeholder={field.placeholder}
                  />
                ) : field.type === "number" ? (
                  <input
                    type="number"
                    value={selectedArticle?.[field.key] || ""}
                    onChange={(e) =>
                      setSelectedArticle({ ...selectedArticle, [field.key]: e.target.value })
                    }
                    className="w-full rounded border border-border bg-bg-3 px-2 py-1.5 text-[11px]"
                  />
                ) : field.type === "date" ? (
                  <input
                    type="date"
                    value={selectedArticle?.[field.key] || ""}
                    onChange={(e) =>
                      setSelectedArticle({ ...selectedArticle, [field.key]: e.target.value })
                    }
                    className="w-full rounded border border-border bg-bg-3 px-2 py-1.5 text-[11px]"
                  />
                ) : (
                  <input
                    type="text"
                    value={selectedArticle?.[field.key] || ""}
                    onChange={(e) =>
                      setSelectedArticle({ ...selectedArticle, [field.key]: e.target.value })
                    }
                    className="w-full rounded border border-border bg-bg-3 px-2 py-1.5 text-[11px]"
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}

            {/* Materials Section */}
            <div>
              <label className="text-xs font-bold uppercase text-text-2 block mb-2">Materials</label>
              <div className="space-y-2">
                {articleMaterials.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {articleMaterials.map((material, idx) => (
                      <div key={idx} className="border border-border rounded p-2 flex items-center justify-between text-[11px]">
                        <span className="truncate">{material.name}</span>
                        <button
                          onClick={() => {
                            const updated = articleMaterials.filter((_, i) => i !== idx);
                            setArticleMaterials(updated);
                          }}
                          className="text-danger ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-[11px] font-bold text-text-1 hover:bg-bg-4">
                  <Icon icon={uploadingMaterial ? "mdi:loading" : "mdi:upload"} className={uploadingMaterial ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                  {uploadingMaterial ? "Uploading…" : "Choose file"}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleMaterialUpload(e.target.files)}
                    disabled={uploadingMaterial}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateMut.mutate(selectedArticle)}
              className="bg-primary hover:opacity-90"
            >
              Save Article
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Action Confirmation Dialog */}
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
              className={confirmAction?.type === "delete" ? "bg-danger hover:opacity-90" : "bg-primary hover:opacity-90"}
            >
              {confirmAction?.type === "delete" ? "Delete" : "Confirm"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
