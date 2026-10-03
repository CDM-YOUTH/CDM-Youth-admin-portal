import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Plus,
  ArrowLeft,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  Music,
  Video,
  Image as ImageIcon,
  Files,
  X,
} from "lucide-react";
import { Topbar, TopbarButton } from "@/components/admin/layout/topbar";
import {
  RecordFormDialog,
  type FieldDef,
} from "@/components/admin/composables/forms/record-form-dialog";
import { ViewRecordDialog } from "@/components/admin/composables/forms/view-record-dialog";
import { CategoryFormDialog } from "@/components/admin/composables/forms/category-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  publishBulletinItem,
  unpublishBulletinItem,
  type BulletinItem,
  type BulletinItemInput,
  type BulletinCategory,
  type BulletinCategoryInput,
} from "@/lib/db/ministry/bulletin";

// Liturgical color palette
const LITURGICAL_COLORS = {
  marian: { name: "Marian", hex: "#F8BBD0", rgb: "248, 187, 208" }, // rose
  scripture: { name: "Scripture", hex: "#90CAF9", rgb: "144, 202, 249" }, // blue
  prayer: { name: "Prayer", hex: "#CE93D8", rgb: "206, 147, 216" }, // lavender
  sacraments: { name: "Sacraments", hex: "#80DEEA", rgb: "128, 222, 234" }, // cyan
  moral: { name: "Moral", hex: "#FFD54F", rgb: "255, 213, 79" }, // amber
  youth: { name: "Youth", hex: "#F9A825", rgb: "249, 168, 37" }, // blush
  justice: { name: "Social Justice", hex: "#A5D6A7", rgb: "165, 214, 167" }, // mint
};

const CATEGORY_COLORS = [
  LITURGICAL_COLORS.marian.hex,
  LITURGICAL_COLORS.scripture.hex,
  LITURGICAL_COLORS.prayer.hex,
  LITURGICAL_COLORS.sacraments.hex,
  LITURGICAL_COLORS.moral.hex,
  LITURGICAL_COLORS.youth.hex,
  LITURGICAL_COLORS.justice.hex,
];

const CONTENT_TYPES = ["PDF", "Audio", "Video", "Image", "Study Guide"] as const;
const LITURGICAL_SEASONS = ["Advent", "Christmas", "Lent", "Easter", "Ordinary Time", "Pentecost"];
const SORT_OPTIONS = ["Newest", "Oldest", "Most Viewed", "Title A-Z", "Title Z-A"];

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
  if (kind === "Image") return "🖼️";
  return "📄";
}

function getContentTypeIcon(kind: string) {
  switch (kind) {
    case "Audio":
      return <Music className="h-4 w-4" />;
    case "Video":
      return <Video className="h-4 w-4" />;
    case "Image":
      return <ImageIcon className="h-4 w-4" />;
    case "PDF":
      return <FileText className="h-4 w-4" />;
    default:
      return <Files className="h-4 w-4" />;
  }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function BulletinPage() {
  const [view, setView] = useState<"categories" | "items">("categories");
  const [selectedCategory, setSelectedCategory] = useState<BulletinCategory | null>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [viewing, setViewing] = useState<BulletinItem | null>(null);
  const [editingItem, setEditingItem] = useState<{
    id: string;
    initial: Record<string, string>;
  } | null>(null);
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    initial: Record<string, string>;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
    type: "category" | "item";
  } | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("");
  const [seasonFilter, setSeasonFilter] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("Newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const qc = useQueryClient();

  // Queries
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["bulletin-categories"],
    queryFn: () => listBulletinCategories(),
  });

  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["bulletin-items", selectedCategory?.id],
    queryFn: () =>
      selectedCategory ? listBulletinItems(selectedCategory.id, false) : Promise.resolve([]),
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
      setCurrentPage(1);
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

  const publishItemMut = useMutation({
    mutationFn: (id: string) => publishBulletinItem(id),
    onSuccess: () => {
      toast.success("Item published.");
      qc.invalidateQueries({ queryKey: ["bulletin-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unpublishItemMut = useMutation({
    mutationFn: (id: string) => unpublishBulletinItem(id),
    onSuccess: () => {
      toast.success("Item unpublished.");
      qc.invalidateQueries({ queryKey: ["bulletin-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filtering and sorting
  const filteredItems = useMemo(() => {
    let result = allItems;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.author?.toLowerCase().includes(q) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    // Content type filter
    if (contentTypeFilter && contentTypeFilter !== "all") {
      result = result.filter((item) => item.kind === contentTypeFilter);
    }

    // Date range filter
    if (dateRangeFilter && dateRangeFilter !== "all") {
      const now = new Date();
      const createdDate = new Date(allItems[0]?.created_at || now);
      result = result.filter((item) => {
        const itemDate = new Date(item.created_at);
        if (dateRangeFilter === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return itemDate >= weekAgo;
        } else if (dateRangeFilter === "month") {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return itemDate >= monthAgo;
        } else if (dateRangeFilter === "year") {
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          return itemDate >= yearAgo;
        }
        return true;
      });
    }

    // Sort
    if (sortOrder === "Newest") {
      result = [...result].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else if (sortOrder === "Oldest") {
      result = [...result].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    } else if (sortOrder === "Most Viewed") {
      result = [...result].sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sortOrder === "Title A-Z") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOrder === "Title Z-A") {
      result = [...result].sort((a, b) => b.title.localeCompare(a.title));
    }

    return result;
  }, [allItems, searchQuery, contentTypeFilter, dateRangeFilter, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleResetFilters = () => {
    setSearchQuery("");
    setContentTypeFilter("");
    setDateRangeFilter("");
    setSeasonFilter("");
    setSortOrder("Newest");
    setCurrentPage(1);
  };

  const handleSelectCategory = (category: BulletinCategory) => {
    setSelectedCategory(category);
    setView("items");
    setCurrentPage(1);
  };

  const handleBackToCategories = () => {
    setView("categories");
    setSelectedCategory(null);
    handleResetFilters();
  };

  return (
    <div className="flex min-h-screen flex-col">
      {view === "categories" ? (
        // Categories View
        <>
          <Topbar
            title="Bulletin Library"
            description="Browse categories and manage formation resources"
            action={
              <TopbarButton onClick={() => setShowCreateCategory(true)}>
                + Create Category
              </TopbarButton>
            }
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
                      {cat.description && (
                        <p className="mb-4 text-xs text-text-3">{cat.description}</p>
                      )}
                      <div
                        className="inline-block rounded-full px-3 py-1 text-xs font-bold"
                        style={{
                          backgroundColor: cat.color ? `${cat.color}20` : undefined,
                          color: cat.color || "currentColor",
                        }}
                      >
                        {allItems.filter((i) => i.category_id === cat.id).length} resources
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
                                  color: cat.color || "",
                                },
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              setDeleteTarget({ id: cat.id, title: cat.name, type: "category" })
                            }
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
        // Items View with Filters
        <>
          <Topbar
            title={selectedCategory?.name || "Bulletin"}
            description={`${filteredItems.length} of ${allItems.length} resource${allItems.length !== 1 ? "s" : ""}`}
            action={
              <TopbarButton onClick={() => setShowAddItem(true)}>+ Add Resource</TopbarButton>
            }
          />
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <button
              onClick={handleBackToCategories}
              className="mb-6 flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Categories
            </button>

            {/* Filter Toolbar */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                {/* Search */}
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-semibold text-text-2 block mb-2">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
                    <Input
                      placeholder="Search by title, author, or tags..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10 border-border"
                    />
                  </div>
                </div>

                {/* Content Type */}
                <div className="lg:w-48">
                  <label className="text-xs font-semibold text-text-2 block mb-2">
                    Content Type
                  </label>
                  <Select
                    value={contentTypeFilter}
                    onValueChange={(v) => {
                      setContentTypeFilter(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="border-border">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      {CONTENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="lg:w-48">
                  <label className="text-xs font-semibold text-text-2 block mb-2">Date Range</label>
                  <Select
                    value={dateRangeFilter}
                    onValueChange={(v) => {
                      setDateRangeFilter(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="border-border">
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All time</SelectItem>
                      <SelectItem value="week">This week</SelectItem>
                      <SelectItem value="month">This month</SelectItem>
                      <SelectItem value="year">This year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort */}
                <div className="lg:w-48">
                  <label className="text-xs font-semibold text-text-2 block mb-2">Sort</label>
                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger className="border-border">
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reset Filters Button */}
              {(searchQuery ||
                contentTypeFilter ||
                dateRangeFilter ||
                seasonFilter ||
                sortOrder !== "Newest") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-text-3 hover:text-text-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear filters
                </Button>
              )}
            </div>

            {itemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-text-3">Loading resources...</p>
              </div>
            ) : allItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-lg text-text-3">No resources in this category</p>
                <p className="text-sm text-text-3 mt-1">Add one to get started</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-lg text-text-3">No resources match your filters</p>
                <p className="text-sm text-text-3 mt-1">Try adjusting your search criteria</p>
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-200/70 bg-slate-50">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold text-text-1">
                            Resource Details
                          </th>
                          <th className="px-6 py-3 text-left font-semibold text-text-1">Author</th>
                          <th className="px-6 py-3 text-left font-semibold text-text-1">Format</th>
                          <th className="px-6 py-3 text-left font-semibold text-text-1">Tags</th>
                          <th className="px-6 py-3 text-left font-semibold text-text-1">Created</th>
                          <th className="px-6 py-3 text-left font-semibold text-text-1">
                            Published
                          </th>
                          <th className="px-6 py-3 text-left font-semibold text-text-1">Status</th>
                          <th className="px-6 py-3 text-right font-semibold text-text-1">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {paginatedItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            {/* Resource Details */}
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base">
                                  {kindIcon(item.kind)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-text-1 truncate">{item.title}</p>
                                  {item.description && (
                                    <p className="text-xs text-text-3 line-clamp-2 mt-1">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Author */}
                            <td className="px-6 py-4 text-text-2">{item.author || "—"}</td>

                            {/* Format & Size */}
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-text-2">
                                {getContentTypeIcon(item.kind)}
                                {item.kind}
                                {item.duration && <span>· {item.duration}</span>}
                              </span>
                            </td>

                            {/* Liturgical Tags */}
                            <td className="px-6 py-4">
                              {item.tags && item.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {item.tags.slice(0, 2).map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-block rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {item.tags.length > 2 && (
                                    <span className="inline-block text-xs text-text-3">
                                      +{item.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-text-3">—</span>
                              )}
                            </td>

                            {/* Date Created */}
                            <td className="px-6 py-4 text-text-2">{formatDate(item.created_at)}</td>

                            {/* Date Published */}
                            <td className="px-6 py-4 text-text-2">
                              {item.published ? (
                                formatDate(item.created_at)
                              ) : (
                                <span className="text-amber-600 font-medium">Draft</span>
                              )}
                            </td>

                            {/* Status Badge */}
                            <td className="px-6 py-4">
                              <span
                                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                                  item.published
                                    ? "bg-green-100 text-green-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {item.published ? "Published" : "Draft"}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="rounded-lg border border-border p-2 hover:bg-bg-2 transition-colors">
                                    <MoreVertical className="h-4 w-4 text-text-3" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setViewing(item)}>
                                    <Eye className="h-4 w-4 mr-2" /> View
                                  </DropdownMenuItem>
                                  {item.file_url && (
                                    <DropdownMenuItem asChild>
                                      <a
                                        href={item.file_url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <Download className="h-4 w-4 mr-2" /> Download
                                      </a>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setEditingItem({ id: item.id, initial: itemToInitial(item) })
                                    }
                                  >
                                    <Pencil className="h-4 w-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {item.published ? (
                                    <DropdownMenuItem
                                      onClick={() => unpublishItemMut.mutate(item.id)}
                                    >
                                      Unpublish
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => publishItemMut.mutate(item.id)}
                                    >
                                      Publish
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setDeleteTarget({
                                        id: item.id,
                                        title: item.title,
                                        type: "item",
                                      })
                                    }
                                    className="text-danger focus:text-danger"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-xs text-text-3">
                    Showing{" "}
                    <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                    <span className="font-semibold">
                      {Math.min(currentPage * itemsPerPage, filteredItems.length)}
                    </span>{" "}
                    of <span className="font-semibold">{filteredItems.length}</span> items
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5 && currentPage > 3) {
                        pageNum = currentPage - 2 + i;
                      }
                      if (pageNum > totalPages) return null;
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="h-8 w-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
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
            {
              key: "kind",
              label: "Type",
              type: "select",
              required: true,
              options: ["PDF", "Audio", "Video", "Image", "Other"],
            },
            { key: "duration", label: "Duration / Pages", placeholder: "e.g. 30 min or 24 pages" },
            { key: "author", label: "Author", placeholder: "e.g. Fr. John" },
            { key: "tags", label: "Tags", placeholder: "prayer, meditation (comma-separated)" },
            {
              key: "description",
              label: "Description",
              type: "textarea",
              placeholder: "Overview of this resource",
            },
            {
              key: "fileUrl",
              label: "File",
              type: "file",
              full: true,
              bucket: "formation",
              accept: "application/pdf,audio/*,video/*,image/*",
              maxSizeMb: 100,
            },
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
            {
              key: "kind",
              label: "Type",
              type: "select",
              required: true,
              options: ["PDF", "Audio", "Video", "Image", "Other"],
            },
            { key: "duration", label: "Duration / Pages", placeholder: "e.g. 30 min" },
            { key: "author", label: "Author", placeholder: "e.g. Fr. John" },
            { key: "tags", label: "Tags", placeholder: "prayer, meditation" },
            { key: "description", label: "Description", type: "textarea" },
            {
              key: "fileUrl",
              label: "File",
              type: "file",
              full: true,
              bucket: "formation",
              accept: "application/pdf,audio/*,video/*,image/*",
              maxSizeMb: 100,
            },
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
                  value: viewing.file_url ? (
                    <a
                      href={viewing.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-primary underline"
                    >
                      {viewing.file_url}
                    </a>
                  ) : (
                    "—"
                  ),
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
              {deleteTarget?.type === "category"
                ? "This will permanently remove this category and all associated resources."
                : "This will permanently remove this resource. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "category") {
                  deleteCategoryMut.mutate(deleteTarget.id);
                } else {
                  deleteItemMut.mutate(deleteTarget.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
