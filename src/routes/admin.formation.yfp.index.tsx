import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, MoreVertical, BarChart3, Pencil, Trash2 } from "lucide-react";
import {
  fetchPillars,
  createPillar,
  updatePillar,
  deletePillar,
  fetchSubPillarsByPillarId,
} from "@/lib/db/ministry/yfp";
import { Topbar, TopbarButton } from "@/components/admin/layout/topbar";
import {
  RecordFormDialog,
  type FieldDef,
} from "@/components/admin/composables/forms/record-form-dialog";
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

export const Route = createFileRoute("/admin/formation/yfp/")({
  component: YFPPage,
});

const PILLAR_FORM_FIELDS: FieldDef[] = [
  {
    key: "name",
    label: "Pillar Name",
    required: true,
    placeholder: "e.g. Catechesis & Spiritual Life",
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    placeholder: "Formation scope and parish youth modules...",
  },
  { key: "icon", label: "Icon", placeholder: "Material icon name (e.g. menu_book)" },
];

function YFPPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: pillars = [] } = useQuery({
    queryKey: ["yfp-pillars"],
    queryFn: fetchPillars,
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPillar, setSelectedPillar] = useState<any>(null);

  const createMut = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const colorScheme = {
        background_fill: "#fff1f2",
        border_stroke: "#881337",
        accent_hex: "#881337",
      };

      return createPillar({
        name: values.name,
        canonical_index: pillars.length + 1,
        description: values.description || undefined,
        icon: values.icon || "menu_book",
        color_scheme: colorScheme,
        has_sub_pillars: true,
      });
    },
    onSuccess: () => {
      toast.success("Pillar created successfully");
      qc.invalidateQueries({ queryKey: ["yfp-pillars"] });
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create pillar");
    },
  });

  const updateMut = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      if (!selectedPillar) return;
      return updatePillar(selectedPillar.id, {
        name: values.name,
        description: values.description || undefined,
        icon: values.icon || "menu_book",
      });
    },
    onSuccess: () => {
      toast.success("Pillar updated successfully");
      qc.invalidateQueries({ queryKey: ["yfp-pillars"] });
      setEditDialogOpen(false);
      setSelectedPillar(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update pillar");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!selectedPillar) return;
      return deletePillar(selectedPillar.id);
    },
    onSuccess: () => {
      toast.success("Pillar deleted successfully");
      qc.invalidateQueries({ queryKey: ["yfp-pillars"] });
      setDeleteDialogOpen(false);
      setSelectedPillar(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete pillar");
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title="Formation Pillars"
        description="Manage youth formation curriculum across pillars, sub-pillars, and weekly content"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => navigate({ to: "/admin/formation/yfp/analytics" })}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-bold text-text-2 hover:bg-bg-2"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </button>
            <TopbarButton onClick={() => setCreateDialogOpen(true)}>+ Create Pillar</TopbarButton>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {pillars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-text-3">No pillars yet</p>
            <p className="mt-1 text-sm text-text-3">Create one to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((pillar) => (
              <PillarCard
                key={pillar.id}
                pillar={pillar}
                onNavigate={() =>
                  navigate({
                    to: "/admin/formation/yfp/pillars/$pillarId/sub-pillars",
                    params: { pillarId: pillar.id },
                  })
                }
                onEdit={() => {
                  setSelectedPillar(pillar);
                  setEditDialogOpen(true);
                }}
                onDelete={() => {
                  setSelectedPillar(pillar);
                  setDeleteDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Pillar Dialog */}
      <RecordFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Create Formation Pillar"
        description="Diocese YFP"
        fields={PILLAR_FORM_FIELDS}
        submitLabel="Create Pillar"
        onSubmit={(values) => createMut.mutate(values)}
      />

      {/* Edit Pillar Dialog */}
      <RecordFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Edit Formation Pillar"
        description="Update pillar details"
        fields={PILLAR_FORM_FIELDS}
        submitLabel="Update Pillar"
        initialValues={
          selectedPillar
            ? {
                name: selectedPillar.name,
                description: selectedPillar.description,
                icon: selectedPillar.icon,
              }
            : undefined
        }
        onSubmit={(values) => updateMut.mutate(values)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Pillar?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "<strong>{selectedPillar?.name}</strong>"? This action
            cannot be undone.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMut.mutate()}
              className="bg-danger hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PillarCard({ pillar, onNavigate, onEdit, onDelete }: any) {
  const { data: subPillars = [] } = useQuery({
    queryKey: ["yfp-sub-pillars", pillar.id],
    queryFn: () => fetchSubPillarsByPillarId(pillar.id),
  });

  const colorScheme = (pillar.color_scheme as any) || {
    background_fill: "#fff1f2",
    border_stroke: "#881337",
    accent_hex: "#881337",
  };

  return (
    <div
      className="group relative cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-md hover:-translate-y-1"
      style={{
        backgroundColor: colorScheme.background_fill,
        borderColor: colorScheme.border_stroke,
      }}
    >
      <div onClick={onNavigate} className="flex-1">
        <div className="mb-3 text-4xl">
          <Icon
            icon={`mdi:${pillar.icon || "menu_book"}`}
            style={{ color: colorScheme.accent_hex }}
          />
        </div>
        <h3 className="mb-2 text-base font-bold text-text-1">{pillar.name}</h3>
        {pillar.description && <p className="mb-4 text-xs text-text-3">{pillar.description}</p>}
        <div className="flex gap-2">
          <div
            className="inline-block rounded-full px-3 py-1 text-xs font-bold"
            style={{
              backgroundColor: `${colorScheme.border_stroke}20`,
              color: colorScheme.border_stroke,
            }}
          >
            {subPillars.length} Sub-Pillar{subPillars.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-lg border border-border bg-white p-2 hover:bg-bg-2">
              <MoreVertical className="h-4 w-4 text-text-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onNavigate}>View Sub-Pillars</DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>Edit Pillar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-danger focus:text-danger">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
