import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, Pill } from "@/components/admin/ui-bits";
import { RecordFormDialog, type FieldDef } from "@/components/admin/record-form-dialog";
import { ViewRecordDialog } from "@/components/admin/view-record-dialog";
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
  createFormationItem,
  deleteFormationItem,
  listFormationItems,
  updateFormationItem,
  type FormationItem,
  type FormationItemInput,
  type FormationKind,
} from "@/lib/db/formation";

export const Route = createFileRoute("/admin/formation")({
  head: () => ({
    meta: [
      { title: "Formation Library — CDM Youth Office" },
      { name: "description", content: "Central catechesis and formation library for all diocese youths." },
    ],
  }),
  component: FormationPage,
});

const contentFields: FieldDef[] = [
  { key: "title",       label: "Title",               required: true, placeholder: "e.g. Lenten Reflection Week 5" },
  { key: "kind",        label: "Content Type",         type: "select", required: true, options: ["PDF", "Audio", "Video", "Image", "Other"] },
  { key: "duration",    label: "Duration / Pages",     placeholder: "e.g. 18 min or 12 pages" },
  { key: "author",      label: "Author / Facilitator", placeholder: "e.g. Fr. Peter / Diocese Chaplain" },
  { key: "tags",        label: "Topics / Tags",        placeholder: "e.g. Lent, Prayer, Vocations (comma-separated)" },
  { key: "description", label: "Description",          type: "textarea", full: true, placeholder: "Brief overview — shown on the library card." },
  { key: "fileUrl",     label: "File URL",             full: true, placeholder: "https://… paste the public URL here" },
];

function itemToInitial(i: FormationItem): Record<string, string> {
  return {
    title:       i.title,
    kind:        i.kind,
    duration:    i.duration    ?? "",
    author:      i.author      ?? "",
    tags:        (i.tags ?? []).join(", "),
    description: i.description ?? "",
    fileUrl:     i.file_url    ?? "",
  };
}

function kindIcon(kind: string) {
  if (kind === "Audio") return "🎧";
  if (kind === "Video") return "▶";
  return "📄";
}

function FormationPage() {
  const [uploadOpen,   setUploadOpen]   = useState(false);
  const [viewing,      setViewing]      = useState<FormationItem | null>(null);
  const [editing,      setEditing]      = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["formation-items"],
    queryFn: () => listFormationItems(true),
  });

  const createMut = useMutation({
    mutationFn: (input: FormationItemInput) => createFormationItem(input),
    onSuccess: (data) => {
      toast.success(`"${data.title}" published to the formation library.`);
      qc.invalidateQueries({ queryKey: ["formation-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: FormationItemInput }) =>
      updateFormationItem(id, input),
    onSuccess: (data) => {
      toast.success(`"${data.title}" updated.`);
      qc.invalidateQueries({ queryKey: ["formation-items"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFormationItem(id),
    onSuccess: () => {
      toast.success("Item removed from library.");
      qc.invalidateQueries({ queryKey: ["formation-items"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const displayItems = items.length > 0 ? items : MOCK_ITEMS;
  const isLive       = items.length > 0;

  const total  = items.length  || 84;
  const views  = items.reduce((s, i) => s + i.views, 0) || 14820;
  const audios = items.filter((i) => i.kind === "Audio").length || 22;
  const videos = items.filter((i) => i.kind === "Video").length || 18;

  return (
    <>
      <Topbar
        title="Formation Library"
        description={isLoading ? "Loading…" : "Catechesis, reflections, prayer guides, and youth Bible study materials."}
        action={<TopbarButton onClick={() => setUploadOpen(true)}>+ Upload Content</TopbarButton>}
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="Total Items" value={String(total)}                   trend="+6 this month" tone="up"   />
          <Kpi label="Total Views" value={views.toLocaleString()}          trend="+1,204"        tone="up"   />
          <Kpi label="Audio"       value={String(audios)}                  trend=""              tone="info" />
          <Kpi label="Video"       value={String(videos)}                  trend=""              tone="info" />
        </div>

        <Card>
          <CardHead title="Recently Published" action="View library →" />
          <CardBody className="space-y-2">
            {displayItems.map((f) => (
              <div key={f.id ?? f.title} className="flex items-start gap-3 rounded-lg border border-border bg-bg-2 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bg-4 text-[14px]">
                  {kindIcon(f.kind)}
                </div>
                <div className="flex-1 leading-tight">
                  <div className="text-[12px] font-semibold text-text-1">{f.title}</div>
                  <div className="text-[10px] text-text-3">
                    {f.kind}{f.duration ? ` · ${f.duration}` : ""}
                    {f.author ? ` · ${f.author}` : ""}
                  </div>
                </div>
                <Pill tone="info">{f.views} views</Pill>
                {isLive && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded p-1 hover:bg-bg-3">
                        <MoreVertical className="h-3.5 w-3.5 text-text-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]">
                      <DropdownMenuItem onClick={() => setViewing(f as FormationItem)}>
                        <Eye className="mr-2 h-3.5 w-3.5" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditing({ id: (f as FormationItem).id, initial: itemToInitial(f as FormationItem) })}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-danger focus:text-danger"
                        onClick={() => setDeleteTarget({ id: (f as FormationItem).id, title: f.title })}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
            {displayItems.length === 0 && !isLoading && (
              <div className="py-6 text-center text-[11px] text-text-3">No items published yet.</div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Upload / Add */}
      <RecordFormDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        title="Upload Formation Content"
        description="Add a new resource to the diocese formation library. All published items are visible to all parishes."
        fields={contentFields}
        submitLabel="Publish Content"
        onSubmit={(values) => {
          createMut.mutate({
            title:       values.title,
            kind:        (values.kind || "PDF") as FormationKind,
            duration:    values.duration    || null,
            author:      values.author      || null,
            tags:        values.tags        || null,
            description: values.description || null,
            fileUrl:     values.fileUrl     || null,
          });
        }}
      />

      {/* Edit */}
      <RecordFormDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        title="Edit Formation Item"
        description="Update the content details. Changes are immediately visible in the library."
        fields={contentFields}
        initial={editing?.initial}
        submitLabel="Save Changes"
        onSubmit={(values) => {
          if (!editing) return;
          updateMut.mutate({
            id: editing.id,
            input: {
              title:       values.title,
              kind:        (values.kind || "PDF") as FormationKind,
              duration:    values.duration    || null,
              author:      values.author      || null,
              tags:        values.tags        || null,
              description: values.description || null,
              fileUrl:     values.fileUrl     || null,
            },
          });
        }}
      />

      {/* View */}
      <ViewRecordDialog
        open={!!viewing}
        onOpenChange={(o) => { if (!o) setViewing(null); }}
        title={viewing?.title ?? ""}
        fields={viewing ? [
          { label: "Title",         value: viewing.title,                      full: true },
          { label: "Type",          value: viewing.kind },
          { label: "Duration",      value: viewing.duration ?? "—" },
          { label: "Author",        value: viewing.author   ?? "—" },
          { label: "Views",         value: String(viewing.views) },
          { label: "Published",     value: viewing.published ? "Yes" : "No" },
          { label: "Tags",          value: viewing.tags?.join(", ") || "—" },
          { label: "Description",   value: viewing.description ?? "—", full: true },
          {
            label: "File URL",
            value: viewing.file_url
              ? <a href={viewing.file_url} target="_blank" rel="noreferrer" className="break-all text-primary underline">{viewing.file_url}</a>
              : "—",
            full: true,
          },
        ] : []}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the item from the formation library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const MOCK_ITEMS = [
  { id: "m1", title: "Lent Reflection — Week 4",   kind: "Audio" as FormationKind, duration: "12 min",   views: 482,  tags: [] as string[], author: null, description: null, file_url: null, published: true, created_at: "" },
  { id: "m2", title: "Catechism: The Eucharist",    kind: "PDF"   as FormationKind, duration: "24 pages", views: 1204, tags: [] as string[], author: null, description: null, file_url: null, published: true, created_at: "" },
  { id: "m3", title: "Youth Bible Study — John 3",  kind: "Video" as FormationKind, duration: "18 min",   views: 728,  tags: [] as string[], author: null, description: null, file_url: null, published: true, created_at: "" },
  { id: "m4", title: "Vocations Discernment Guide", kind: "PDF"   as FormationKind, duration: "16 pages", views: 384,  tags: [] as string[], author: null, description: null, file_url: null, published: true, created_at: "" },
  { id: "m5", title: "Mission Week Prayer Booklet", kind: "PDF"   as FormationKind, duration: "8 pages",  views: 612,  tags: [] as string[], author: null, description: null, file_url: null, published: true, created_at: "" },
];
