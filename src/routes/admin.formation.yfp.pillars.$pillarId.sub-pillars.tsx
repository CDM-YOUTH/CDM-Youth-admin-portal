import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { Plus, MoreVertical, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import {
  fetchPillarById,
  fetchSubPillarsByPillarId,
  createSubPillar,
  fetchWeeklyArticlesBySubPillarId,
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
import { Icon } from "@iconify/react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/formation/yfp/pillars/$pillarId/sub-pillars")({
  component: YFPSubPillars,
});

const SUB_PILLAR_FORM_FIELDS: FieldDef[] = [
  {
    key: "track_number",
    label: "Track Number",
    required: true,
    placeholder: "e.g. TRACK-01",
  },
  {
    key: "title",
    label: "Sub-Pillar Title",
    required: true,
    placeholder: "e.g. Catechesis I: Foundations of Faith",
  },
  {
    key: "age_cohort",
    label: "Age Cohort",
    placeholder: "e.g. Ages 13–15 (Form 1 & 2)",
  },
  {
    key: "curriculum_scope",
    label: "Curriculum Scope",
    type: "textarea",
    placeholder: "What topics are covered in this track?",
  },
];

function YFPSubPillars() {
  const { pillarId } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: pillar } = useQuery({
    queryKey: ["yfp-pillar", pillarId],
    queryFn: () => fetchPillarById(pillarId),
  });

  const { data: subPillars = [] } = useQuery({
    queryKey: ["yfp-sub-pillars", pillarId],
    queryFn: () => fetchSubPillarsByPillarId(pillarId),
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const createMut = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      return createSubPillar({
        pillar_id: pillarId,
        track_number: values.track_number,
        title: values.title,
        age_cohort: values.age_cohort || undefined,
        curriculum_scope: values.curriculum_scope || undefined,
        status: "Active",
      });
    },
    onSuccess: () => {
      toast.success("Sub-pillar created successfully");
      qc.invalidateQueries({ queryKey: ["yfp-sub-pillars", pillarId] });
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create sub-pillar");
    },
  });

  const colorScheme = (pillar?.color_scheme as any) || {
    background_fill: "#fff1f2",
    border_stroke: "#881337",
    accent_hex: "#881337",
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        title={pillar?.name || "Sub-Pillars"}
        description="Manage sequential curriculum tracks and progressive formation stages"
        action={
          <TopbarButton onClick={() => setCreateDialogOpen(true)}>+ Add Sub-Pillar</TopbarButton>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <button
          onClick={() => navigate({ to: "/admin/formation/yfp" })}
          className="mb-4 flex items-center gap-2 text-sm font-bold text-text-2 hover:text-text-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Formation Pillars
        </button>

        {subPillars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-text-3">No sub-pillars yet</p>
            <p className="mt-1 text-sm text-text-3">Create one to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subPillars.map((subPillar) => (
              <SubPillarCard
                key={subPillar.id}
                subPillar={subPillar}
                colorScheme={colorScheme}
                onNavigate={() =>
                  navigate({
                    to: "/admin/formation/yfp/sub-pillars/$subPillarId/articles",
                    params: { subPillarId: subPillar.id },
                  })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Sub-Pillar Dialog */}
      <RecordFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Add Sub-Pillar"
        description={`Add a grade track to ${pillar?.name}`}
        fields={SUB_PILLAR_FORM_FIELDS}
        submitLabel="Create Sub-Pillar"
        onSubmit={(values) => createMut.mutate(values)}
      />
    </div>
  );
}

function SubPillarCard({ subPillar, colorScheme, onNavigate }: any) {
  const { data: articles = [] } = useQuery({
    queryKey: ["yfp-weekly-articles", subPillar.id],
    queryFn: () => fetchWeeklyArticlesBySubPillarId(subPillar.id),
  });

  return (
    <button
      className="group relative w-full rounded-xl border-2 p-6 transition-all hover:shadow-md hover:-translate-y-1 text-left"
      style={{
        backgroundColor: colorScheme.background_fill,
        borderColor: colorScheme.border_stroke,
      }}
      onClick={onNavigate}
    >
      <div className="flex-1">
        <div className="mb-3 text-3xl">
          <Icon icon="mdi:book-open-variant" style={{ color: colorScheme.accent_hex }} />
        </div>
        <h3 className="mb-2 text-base font-bold text-text-1">{subPillar.title}</h3>
        {subPillar.age_cohort && <p className="mb-2 text-xs text-text-3">{subPillar.age_cohort}</p>}
        {subPillar.curriculum_scope && (
          <p className="mb-4 line-clamp-2 text-xs text-text-3">{subPillar.curriculum_scope}</p>
        )}
        <div className="flex gap-2">
          <div
            className="inline-block rounded-full px-3 py-1 text-xs font-bold"
            style={{
              backgroundColor: `${colorScheme.border_stroke}20`,
              color: colorScheme.border_stroke,
            }}
          >
            {articles.length} Weekly Article{articles.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-lg border border-border bg-white p-2 hover:bg-bg-2">
              <MoreVertical className="h-4 w-4 text-text-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit Sub-Pillar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger focus:text-danger">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </button>
  );
}
