import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Plus, Trash2, ChevronDown, ArrowLeft, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Topbar, TopbarButton } from "@/components/admin/layout/topbar";
import { Card, CardBody, CardHead } from "@/components/admin/composables/ui-bits";
import { RecordFormDialog } from "@/components/admin/composables/forms/record-form-dialog";
import { PillarFormDialog } from "@/components/admin/composables/forms/pillar-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listYFPCurricula,
  createYFPCurriculum,
  updateYFPCurriculum,
  deleteYFPCurriculum,
  listYFPPillars,
  createYFPPillar,
  updateYFPPillar,
  deleteYFPPillar,
  listYFPArticles,
  updateYFPArticle,
  deleteYFPArticle,
  type YFPCurriculum,
  type YFPPillar,
  type YFPArticle,
  type YFPCurriculumInput,
  type YFPPillarInput,
  type YFPArticleInput,
} from "@/lib/db/ministry/yfp";

export const Route = createFileRoute("/admin/formation/yfp")({
  head: () => ({
    meta: [
      { title: "YFP Curriculum — CDM Youth Office" },
      { name: "description", content: "Manage Youth Formation Program curriculum" },
    ],
  }),
  component: YFPPage,
});

type View = "curricula" | "pillars" | "articles";

function YFPPage() {
  const [view, setView] = useState<View>("curricula");
  const [selectedCurriculum, setSelectedCurriculum] = useState<YFPCurriculum | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<YFPPillar | null>(null);
  const [showCreateCurriculum, setShowCreateCurriculum] = useState(false);
  const [showCreatePillar, setShowCreatePillar] = useState(false);
  const [editingCurriculum, setEditingCurriculum] = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [editingPillar, setEditingPillar] = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [editingArticle, setEditingArticle] = useState<{ id: string; initial: Record<string, any> } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; type: "curriculum" | "pillar" | "article" } | null>(null);
  const qc = useQueryClient();

  // Queries
  const { data: curricula = [], isLoading: curriculaLoading } = useQuery({
    queryKey: ["yfp-curricula"],
    queryFn: () => listYFPCurricula(true),
  });

  const { data: pillars = [], isLoading: pillarsLoading } = useQuery({
    queryKey: ["yfp-pillars", selectedCurriculum?.id],
    queryFn: () => (selectedCurriculum ? listYFPPillars(selectedCurriculum.id) : Promise.resolve([])),
    enabled: !!selectedCurriculum,
  });

  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ["yfp-articles", selectedCurriculum?.id],
    queryFn: () => (selectedCurriculum ? listYFPArticles(selectedCurriculum.id) : Promise.resolve([])),
    enabled: !!selectedCurriculum,
  });

  // Mutations
  const createCurriculumMut = useMutation({
    mutationFn: (input: YFPCurriculumInput) => createYFPCurriculum(input),
    onSuccess: () => {
      toast.success("Curriculum created.");
      qc.invalidateQueries({ queryKey: ["yfp-curricula"] });
      setShowCreateCurriculum(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createPillarMut = useMutation({
    mutationFn: (input: YFPPillarInput) => createYFPPillar(input),
    onSuccess: () => {
      toast.success("Pillar created.");
      qc.invalidateQueries({ queryKey: ["yfp-pillars"] });
      setShowCreatePillar(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCurriculumMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: YFPCurriculumInput }) =>
      updateYFPCurriculum(id, input),
    onSuccess: () => {
      toast.success("Curriculum updated.");
      qc.invalidateQueries({ queryKey: ["yfp-curricula"] });
      setEditingCurriculum(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCurriculumMut = useMutation({
    mutationFn: (id: string) => deleteYFPCurriculum(id),
    onSuccess: () => {
      toast.success("Curriculum deleted.");
      qc.invalidateQueries({ queryKey: ["yfp-curricula"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePillarMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: YFPPillarInput }) =>
      updateYFPPillar(id, input),
    onSuccess: () => {
      toast.success("Pillar updated.");
      qc.invalidateQueries({ queryKey: ["yfp-pillars"] });
      setEditingPillar(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePillarMut = useMutation({
    mutationFn: (id: string) => deleteYFPPillar(id),
    onSuccess: () => {
      toast.success("Pillar deleted.");
      qc.invalidateQueries({ queryKey: ["yfp-pillars"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateArticleMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: YFPArticleInput }) =>
      updateYFPArticle(id, input),
    onSuccess: () => {
      toast.success("Article updated.");
      qc.invalidateQueries({ queryKey: ["yfp-articles"] });
      setEditingArticle(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteArticleMut = useMutation({
    mutationFn: (id: string) => deleteYFPArticle(id),
    onSuccess: () => {
      toast.success("Article deleted.");
      qc.invalidateQueries({ queryKey: ["yfp-articles"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSelectCurriculum = (curriculum: YFPCurriculum) => {
    setSelectedCurriculum(curriculum);
    setView("pillars");
  };

  const handleSelectPillar = (pillar: YFPPillar) => {
    setSelectedPillar(pillar);
    setView("articles");
  };

  const handleBackToCurricula = () => {
    setView("curricula");
    setSelectedCurriculum(null);
    setSelectedPillar(null);
  };

  const handleBackToPillars = () => {
    setView("pillars");
    setSelectedPillar(null);
  };

  return (
    <>
      {view === "curricula" ? (
        // Curricula View
        <>
          <Topbar
            title="YFP Curriculum"
            description="Select a curriculum to manage its content"
            action={<TopbarButton onClick={() => setShowCreateCurriculum(true)}>+ Create Curriculum</TopbarButton>}
          />
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {curriculaLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-text-3">Loading curricula...</p>
              </div>
            ) : curricula.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-lg text-text-3">No curricula yet</p>
                <p className="text-sm text-text-3 mt-1">Create one to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {curricula.map((c) => (
                  <div
                    key={c.id}
                    className="group relative cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-md hover:-translate-y-1"
                    style={{
                      backgroundColor: "#1e40af15",
                      borderColor: "#1e40af",
                    }}
                  >
                    <div onClick={() => handleSelectCurriculum(c)} className="flex-1">
                      <div className="mb-3 text-4xl">📚</div>
                      <h3 className="mb-2 text-base font-bold text-text-1">{c.title}</h3>
                      {c.description && <p className="mb-4 text-xs text-text-3">{c.description}</p>}
                      <div className="flex gap-2">
                        <div
                          className="inline-block rounded-full px-3 py-1 text-xs font-bold"
                          style={{
                            backgroundColor: "#1e40af20",
                            color: "#1e40af",
                          }}
                        >
                          Active
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-lg bg-white border border-border p-2 hover:bg-bg-2">
                            <MoreVertical className="h-4 w-4 text-text-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingCurriculum({
                                id: c.id,
                                initial: {
                                  title: c.title,
                                  description: c.description || "",
                                },
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget({ id: c.id, title: c.title, type: "curriculum" })}
                            className="text-danger focus:text-danger"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : view === "pillars" ? (
        // Pillars View
        <>
          <Topbar
            title={selectedCurriculum?.title || "YFP"}
            description={`${pillars.length} pillar${pillars.length !== 1 ? "s" : ""}`}
            action={<TopbarButton onClick={() => setShowCreatePillar(true)}>+ Add Pillar</TopbarButton>}
          />
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <button
              onClick={handleBackToCurricula}
              className="mb-4 flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Curricula
            </button>

            {pillarsLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-text-3">Loading pillars...</p>
              </div>
            ) : pillars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-lg text-text-3">No pillars in this curriculum</p>
                <p className="text-sm text-text-3 mt-1">Add one to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pillars.map((pillar) => (
                  <div
                    key={pillar.id}
                    className="group cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md hover:-translate-y-0.5 flex items-start gap-4"
                    style={{
                      backgroundColor: pillar.color ? `${pillar.color}15` : undefined,
                      borderColor: pillar.color || "currentColor",
                    }}
                  >
                    <div onClick={() => handleSelectPillar(pillar)} className="flex-1 flex items-start gap-4">
                      <div className="text-2xl">{pillar.icon || "🏛️"}</div>
                      <div className="flex-1">
                        <h4 className="font-bold text-text-1">{pillar.name}</h4>
                        {pillar.description && <p className="mt-1 text-sm text-text-3">{pillar.description}</p>}
                        <div
                          className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold"
                          style={{
                            backgroundColor: pillar.color ? `${pillar.color}20` : undefined,
                            color: pillar.color || "currentColor",
                          }}
                        >
                          {articles.filter((a) => a.pillar_id === pillar.id).length} articles
                        </div>
                      </div>
                    </div>
                    <div className="opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-lg border border-border p-2 hover:bg-bg-2">
                            <MoreVertical className="h-4 w-4 text-text-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingPillar({
                                id: pillar.id,
                                initial: {
                                  name: pillar.name,
                                  description: pillar.description || "",
                                  icon: pillar.icon || "",
                                },
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget({ id: pillar.id, title: pillar.name, type: "pillar" })}
                            className="text-danger focus:text-danger"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        // Articles View
        <>
          <Topbar
            title={selectedPillar?.name || "Articles"}
            description={`${articles.filter((a) => a.pillar_id === selectedPillar?.id).length} article${articles.filter((a) => a.pillar_id === selectedPillar?.id).length !== 1 ? "s" : ""}`}
            action={<TopbarButton onClick={() => {/* TODO: Add article */}}>+ Add Article</TopbarButton>}
          />
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <button
              onClick={handleBackToPillars}
              className="mb-4 flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Pillars
            </button>

            {articlesLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-text-3">Loading articles...</p>
              </div>
            ) : selectedPillar ? (
              articles.filter((a) => a.pillar_id === selectedPillar.id).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-lg text-text-3">No articles in this pillar</p>
                  <p className="text-sm text-text-3 mt-1">Add one to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {articles
                    .filter((a) => a.pillar_id === selectedPillar.id)
                    .sort((a, b) => a.article_number - b.article_number)
                    .map((article) => (
                      <div key={article.id} className="group flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-bg-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">
                          📖
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-text-1 text-sm">
                            {article.article_number}. {article.title}
                          </h4>
                          {article.scriptural_references && article.scriptural_references.length > 0 && (
                            <div className="mt-1 text-xs text-text-3">
                              📖 {article.scriptural_references.join(", ")}
                            </div>
                          )}
                          {article.tags && article.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {article.tags.map((tag) => (
                                <span key={tag} className="text-[10px] bg-bg-3 text-text-3 px-2 py-0.5 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="opacity-0 transition-opacity group-hover:opacity-100">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-lg border border-border p-2 hover:bg-bg-2">
                                <MoreVertical className="h-4 w-4 text-text-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingArticle({
                                    id: article.id,
                                    initial: {
                                      title: article.title,
                                      content: article.content,
                                      scriptural_references: (article.scriptural_references || []).join(", "),
                                      tags: (article.tags || []).join(", "),
                                    },
                                  });
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget({ id: article.id, title: article.title, type: "article" })}
                                className="text-danger focus:text-danger"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                </div>
              )
            ) : null}
          </div>
        </>
      )}

      {/* Create Curriculum Dialog */}
      <RecordFormDialog
        open={showCreateCurriculum}
        onOpenChange={setShowCreateCurriculum}
        title="Create Curriculum"
        description="Create a new Youth Formation Program curriculum"
        fields={[
          { key: "title", label: "Curriculum Title", required: true, placeholder: "e.g. YFP 2026 Main Track" },
          { key: "description", label: "Description", type: "textarea", placeholder: "Overview of this curriculum" },
        ]}
        submitLabel="Create Curriculum"
        onSubmit={(values) => {
          createCurriculumMut.mutate({
            title: values.title,
            description: values.description || null,
          });
        }}
      />

      {/* Create Pillar Dialog */}
      {selectedCurriculum && (
        <PillarFormDialog
          open={showCreatePillar}
          onOpenChange={setShowCreatePillar}
          title="Add Pillar"
          description={`Add a new pillar to ${selectedCurriculum.title}`}
          submitLabel="Create Pillar"
          onSubmit={(values) => {
            createPillarMut.mutate({
              curriculum_id: selectedCurriculum.id,
              name: values.name,
              description: values.description,
              icon: values.icon,
              color: values.color,
            });
          }}
          isLoading={createPillarMut.isPending}
        />
      )}

      {/* Edit Curriculum Dialog */}
      {editingCurriculum && (
        <RecordFormDialog
          open={!!editingCurriculum}
          onOpenChange={(o) => {
            if (!o) setEditingCurriculum(null);
          }}
          title="Edit Curriculum"
          description="Update the curriculum details"
          fields={[
            { key: "title", label: "Curriculum Title", required: true, placeholder: "e.g. YFP 2026 Main Track" },
            { key: "description", label: "Description", type: "textarea", placeholder: "Overview of this curriculum" },
          ]}
          initial={editingCurriculum.initial}
          submitLabel="Save Changes"
          onSubmit={(values) => {
            if (!editingCurriculum) return;
            updateCurriculumMut.mutate({
              id: editingCurriculum.id,
              input: {
                title: values.title,
                description: values.description || null,
              },
            });
          }}
        />
      )}

      {/* Edit Pillar Dialog */}
      {editingPillar && (
        <PillarFormDialog
          open={!!editingPillar}
          onOpenChange={(o) => {
            if (!o) setEditingPillar(null);
          }}
          title="Edit Pillar"
          description="Update the pillar details"
          initial={editingPillar.initial}
          submitLabel="Save Changes"
          onSubmit={(values) => {
            if (!editingPillar || !selectedCurriculum) return;
            updatePillarMut.mutate({
              id: editingPillar.id,
              input: {
                curriculum_id: selectedCurriculum.id,
                name: values.name,
                description: values.description,
                icon: values.icon,
                color: values.color,
              },
            });
          }}
          isLoading={updatePillarMut.isPending}
        />
      )}

      {/* Edit Article Dialog */}
      {editingArticle && (
        <RecordFormDialog
          open={!!editingArticle}
          onOpenChange={(o) => {
            if (!o) setEditingArticle(null);
          }}
          title="Edit Article"
          description="Update the article details"
          fields={[
            { key: "title", label: "Article Title", required: true, placeholder: "e.g. Called by Christ" },
            { key: "content", label: "Content", type: "textarea", required: true, placeholder: "Article text" },
            { key: "scriptural_references", label: "Scriptural References", placeholder: "Jn 1:1, Mt 16:18 (comma-separated)" },
            { key: "tags", label: "Tags", placeholder: "foundation, faith (comma-separated)" },
          ]}
          initial={editingArticle.initial}
          submitLabel="Save Changes"
          onSubmit={(values) => {
            if (!editingArticle || !selectedCurriculum || !selectedPillar) return;
            updateArticleMut.mutate({
              id: editingArticle.id,
              input: {
                curriculum_id: selectedCurriculum.id,
                pillar_id: selectedPillar.id,
                article_number: 1,
                title: values.title,
                content: values.content,
                scriptural_references: values.scriptural_references
                  ? values.scriptural_references.split(",").map((s: string) => s.trim())
                  : [],
                tags: values.tags
                  ? values.tags.split(",").map((s: string) => s.trim())
                  : [],
              },
            });
          }}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => (o ? null : setDeleteTarget(null))}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this {deleteTarget?.type}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "article") deleteArticleMut.mutate(deleteTarget.id);
                else if (deleteTarget.type === "pillar") deletePillarMut.mutate(deleteTarget.id);
                else if (deleteTarget.type === "curriculum") deleteCurriculumMut.mutate(deleteTarget.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
