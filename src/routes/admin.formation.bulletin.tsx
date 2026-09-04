import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Eye, Pencil, Trash2, Plus, ChevronRight, ArrowLeft } from "lucide-react";
import { Topbar, TopbarButton } from "@/components/admin/layout/topbar";
import { Card, CardBody, CardHead } from "@/components/admin/composables/ui-bits";
import { RecordFormDialog, type FieldDef } from "@/components/admin/composables/forms/record-form-dialog";
import { ViewRecordDialog } from "@/components/admin/composables/forms/view-record-dialog";
import { CategoryFormDialog } from "@/components/admin/composables/forms/category-form-dialog";
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createBulletinItem,
  createBulletinCategory,
  deleteBulletinItem,
  listBulletinItems,
  listBulletinCategories,
  updateBulletinItem,
  deleteBulletinCategory,
  updateBulletinCategory,
  type BulletinItem,
  type BulletinItemInput,
  type BulletinCategory,
  type BulletinCategoryInput,
} from "@/lib/db/ministry/bulletin";

export const Route = createFileRoute("/admin/formation/bulletin")({
  head: () => ({
    meta: [
      { title: "Bulletin Library — CDM Youth Office" },
      { name: "description", content: "Manage formation bulletins and resources" },
    ],
  }),
  component: BulletinPage,
});

function kindIcon(kind: string) {
  if (kind === "Audio") return "🎧";
  if (kind === "Video") return "▶️";
  return "📄";
}

function BulletinPage() {
  const [view, setView] = useState<"categories" | "items">("categories");
  const [selectedCategory, setSelectedCategory] = useState<BulletinCategory | null>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [viewing, setViewing] = useState<BulletinItem | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; type: "category" | "item" } | null>(null);
  const qc = useQueryClient();

  // Queries
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["bulletin-categories"],
    queryFn: () => listBulletinCategories(),
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["bulletin-items", selectedCategory?.id],
    queryFn: () => (selectedCategory ? listBulletinItems(selectedCategory.id, true) : Promise.resolve([])),
    enabled: !!selectedCategory,
  });

  // Mutations
  const createCategoryMut = useMutation({
    mutationFn: (input: BulletinCategoryInput) => createBulletinCategory(input),
    onSuccess: () => {
      toast.success("Category created.");
      qc.invalidateQueries({ queryKey: ["bulletin-categories"] });
      setShowCreateCategory(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCategoryMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: BulletinCategoryInput }) =>
      updateBulletinCategory(id, input),
    onSuccess: () => {
      toast.success("Category updated.");
      qc.invalidateQueries({ queryKey: ["bulletin-categories"] });
      setEditingCategory(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCategoryMut = useMutation({
    mutationFn: (id: string) => deleteBulletinCategory(id),
    onSuccess: () => {
      toast.success("Category deleted.");
      qc.invalidateQueries({ queryKey: ["bulletin-categories"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createItemMut = useMutation({
    mutationFn: (input: BulletinItemInput) => createBulletinItem(input),
    onSuccess: (data) => {
      toast.success(`"${data.title}" added to ${selectedCategory?.name}.`);
      qc.invalidateQueries({ queryKey: ["bulletin-items"] });
      setShowAddItem(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItemMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: BulletinItemInput }) =>
      updateBulletinItem(id, input),
    onSuccess: () => {
      toast.success("Item updated.");
      qc.invalidateQueries({ queryKey: ["bulletin-items"] });
      setEditingItem(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItemMut = useMutation({
    mutationFn: (id: string) => deleteBulletinItem(id),
    onSuccess: () => {
      toast.success("Item deleted.");
      qc.invalidateQueries({ queryKey: ["bulletin-items"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSelectCategory = (category: BulletinCategory) => {
    setSelectedCategory(category);
    setView("items");
  };

  const handleBackToCategories = () => {
    setView("categories");
    setSelectedCategory(null);
  };

  return (
    <>
      {view === "categories" ? (
        // Categories View
        <>
          <Topbar
            title="Bulletin Library"
            description="Browse categories and manage formation resources"
            action={<TopbarButton onClick={() => setShowCreateCategory(true)}>+ Create Category</TopbarButton>}
          />
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {categoriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-text-3">Loading categories...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-lg text-text-3">No categories yet</p>
                <p className="text-sm text-text-3 mt-1">Create one to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="group relative cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-md hover:-translate-y-1"
                    style={{
                      backgroundColor: cat.color ? `${cat.color}15` : undefined,
                      borderColor: cat.color || "currentColor",
                    }}
                  >
                    <div onClick={() => handleSelectCategory(cat)} className="flex-1">
                      <div className="mb-3 text-4xl">{cat.icon || "📁"}</div>
                      <h3 className="mb-2 text-base font-bold text-text-1">{cat.name}</h3>
                      {cat.description && <p className="mb-4 text-xs text-text-3">{cat.description}</p>}
                      <div
                        className="inline-block rounded-full px-3 py-1 text-xs font-bold"
                        style={{
                          backgroundColor: cat.color ? `${cat.color}20` : undefined,
                          color: cat.color || "currentColor",
                        }}
                      >
                        {items.filter((i) => i.category_id === cat.id).length} resources
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
                              setEditingCategory({
                                id: cat.id,
                                initial: {
                                  name: cat.name,
                                  description: cat.description || "",
                                  icon: cat.icon || "",
                                },
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget({ id: cat.id, title: cat.name, type: "category" })}
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
        // Items View
        <>
          <Topbar
            title={selectedCategory?.name || "Bulletin"}
            description={`${items.length} resource${items.length !== 1 ? "s" : ""}`}
            action={<TopbarButton onClick={() => setShowAddItem(true)}>+ Add Resource</TopbarButton>}
          />
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <button
              onClick={handleBackToCategories}
              className="mb-4 flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Categories
            </button>

            {itemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-text-3">Loading resources...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-lg text-text-3">No resources in this category</p>
                <p className="text-sm text-text-3 mt-1">Add one to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="group flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-bg-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-bg-3 text-xl">
                      {kindIcon(item.kind)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-text-1 text-sm">{item.title}</h4>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-3">
                        <span>{item.kind}</span>
                        {item.duration && <span>· {item.duration}</span>}
                        {item.author && <span>· {item.author}</span>}
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
                          <DropdownMenuItem onClick={() => setViewing(item)}>
                            <Eye className="h-4 w-4 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingItem({ id: item.id, initial: itemToInitial(item) })}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget({ id: item.id, title: item.title, type: "item" })}
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
      )}

      {/* Create Category Dialog */}
      <CategoryFormDialog
        open={showCreateCategory}
        onOpenChange={setShowCreateCategory}
        title="Create Category"
        description="Create a new category to organize bulletin resources"
        submitLabel="Create Category"
        onSubmit={(values) => {
          createCategoryMut.mutate({
            name: values.name,
            description: values.description,
            icon: values.icon,
            color: values.color,
          });
        }}
        isLoading={createCategoryMut.isPending}
      />

      {/* Add Item Dialog */}
      {selectedCategory && (
        <RecordFormDialog
          open={showAddItem}
          onOpenChange={setShowAddItem}
          title="Add Resource"
          description={`Add a new resource to ${selectedCategory.name}`}
          fields={[
            { key: "title", label: "Title", required: true, placeholder: "e.g. Rosary Meditation" },
            { key: "kind", label: "Type", type: "select", required: true, options: ["PDF", "Audio", "Video", "Image", "Other"] },
            { key: "duration", label: "Duration / Pages", placeholder: "e.g. 30 min or 24 pages" },
            { key: "author", label: "Author", placeholder: "e.g. Fr. John" },
            { key: "tags", label: "Tags", placeholder: "prayer, meditation (comma-separated)" },
            { key: "description", label: "Description", type: "textarea", placeholder: "Overview of this resource" },
            { key: "fileUrl", label: "File", type: "file", full: true, bucket: "formation", accept: "application/pdf,audio/*,video/*,image/*", maxSizeMb: 100 },
          ]}
          submitLabel="Add Resource"
          onSubmit={(values) => {
            createItemMut.mutate({
              title: values.title,
              kind: (values.kind || "PDF") as any,
              category_id: selectedCategory.id,
              duration: values.duration || null,
              author: values.author || null,
              tags: values.tags || null,
              description: values.description || null,
              fileUrl: values.fileUrl || null,
            });
          }}
        />
      )}

      {/* Edit Item Dialog */}
      {editingItem && (
        <RecordFormDialog
          open={!!editingItem}
          onOpenChange={(o) => {
            if (!o) setEditingItem(null);
          }}
          title="Edit Resource"
          description="Update the resource details"
          fields={[
            { key: "title", label: "Title", required: true, placeholder: "e.g. Rosary Meditation" },
            { key: "kind", label: "Type", type: "select", required: true, options: ["PDF", "Audio", "Video", "Image", "Other"] },
            { key: "duration", label: "Duration / Pages", placeholder: "e.g. 30 min" },
            { key: "author", label: "Author", placeholder: "e.g. Fr. John" },
            { key: "tags", label: "Tags", placeholder: "prayer, meditation" },
            { key: "description", label: "Description", type: "textarea" },
            { key: "fileUrl", label: "File", type: "file", full: true, bucket: "formation", accept: "application/pdf,audio/*,video/*,image/*", maxSizeMb: 100 },
          ]}
          initial={editingItem.initial}
          submitLabel="Save Changes"
          onSubmit={(values) => {
            if (!editingItem) return;
            updateItemMut.mutate({
              id: editingItem.id,
              input: {
                title: values.title,
                kind: (values.kind || "PDF") as any,
                duration: values.duration || null,
                author: values.author || null,
                tags: values.tags || null,
                description: values.description || null,
                fileUrl: values.fileUrl || null,
              },
            });
          }}
        />
      )}

      {/* Edit Category Dialog */}
      {editingCategory && (
        <CategoryFormDialog
          open={!!editingCategory}
          onOpenChange={(o) => {
            if (!o) setEditingCategory(null);
          }}
          title="Edit Category"
          description="Update the category details"
          initial={editingCategory.initial}
          submitLabel="Save Changes"
          onSubmit={(values) => {
            if (!editingCategory) return;
            updateCategoryMut.mutate({
              id: editingCategory.id,
              input: {
                name: values.name,
                description: values.description,
                icon: values.icon,
                color: values.color,
              },
            });
          }}
          isLoading={updateCategoryMut.isPending}
        />
      )}

      {/* View Dialog */}
      <ViewRecordDialog
        open={!!viewing}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
        title={viewing?.title ?? ""}
        fields={
          viewing
            ? [
                { label: "Title", value: viewing.title, full: true },
                { label: "Category", value: viewing.category?.name || "—" },
                { label: "Type", value: viewing.kind },
                { label: "Duration", value: viewing.duration ?? "—" },
                { label: "Author", value: viewing.author ?? "—" },
                { label: "Tags", value: viewing.tags?.join(", ") || "—" },
                { label: "Description", value: viewing.description ?? "—", full: true },
                {
                  label: "File",
                  value: viewing.file_url
                    ? <a href={viewing.file_url} target="_blank" rel="noreferrer" className="break-all text-primary underline">{viewing.file_url}</a>
                    : "—",
                  full: true,
                },
              ]
            : []
        }
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => (o ? null : setDeleteTarget(null))}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this resource. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => deleteTarget && deleteItemMut.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function itemToInitial(i: BulletinItem): Record<string, string> {
  return {
    title: i.title,
    kind: i.kind,
    duration: i.duration ?? "",
    author: i.author ?? "",
    tags: (i.tags ?? []).join(", "),
    description: i.description ?? "",
    fileUrl: i.file_url ?? "",
  };
}
