import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Icon } from "@iconify/react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Topbar, TopbarTab } from "@/components/admin/layout/topbar";
import { Card, CardBody } from "@/components/admin/composables/ui-bits";
import {
  listParishClasses,
  createParishClass,
  updateParishClass,
  deleteParishClass,
  listEventsByYear,
  listAllYears,
  createEvent,
  updateEventRate,
  deleteEvent,
  getEnrollmentRate,
  updateEnrollmentRate,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectAllocationMatrix,
  createProjectAllocation,
  updateProjectAllocation,
  deleteProjectAllocation,
  copyProjectAllocationYear,
} from "@/lib/db/finances-config";

export const Route = createFileRoute("/admin/finances-config")({
  head: () => ({
    meta: [
      { title: "Finance Config — CDM Youth Office" },
      {
        name: "description",
        content: "Budget planning and obligation configuration.",
      },
    ],
  }),
  component: FinancesConfigPage,
});

type ConfigTab = "parish-classes" | "events" | "enrollment" | "projects";

// Year range constant
const YEAR_RANGE = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

function FinancesConfigPage() {
  const [tab, setTab] = useState<ConfigTab>("events");
  const [selectedEnrollmentYear, setSelectedEnrollmentYear] = useState(new Date().getFullYear());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const qc = useQueryClient();

  // Modals state
  const [classModal, setClassModal] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [eventModal, setEventModal] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [enrollmentModal, setEnrollmentModal] = useState(false);
  const [projectModal, setProjectModal] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [yearModal, setYearModal] = useState(false);
  const [allocationModal, setAllocationModal] = useState<{ open: boolean; edit?: any }>({
    open: false,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type?: string; id?: string }>(
    {
      open: false,
    },
  );

  // Events tab state
  const [eventYearsFilter, setEventYearsFilter] = useState<Set<number>>(new Set(YEAR_RANGE));

  // Fetch all data
  const { data: parishClasses = [] } = useQuery({
    queryKey: ["parish-classes"],
    queryFn: listParishClasses,
  });

  const { data: allEventsData = [] } = useQuery({
    queryKey: ["all-events"],
    queryFn: async () => {
      const allEvents = await Promise.all(YEAR_RANGE.map((y) => listEventsByYear(y)));
      return allEvents.flat();
    },
  });

  const { data: enrollmentRate } = useQuery({
    queryKey: ["enrollment-rate", selectedEnrollmentYear],
    queryFn: () => getEnrollmentRate(selectedEnrollmentYear),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const { data: projectAllocations = [] } = useQuery({
    queryKey: ["project-allocations", selectedProjectId],
    queryFn: () =>
      selectedProjectId ? getProjectAllocationMatrix(selectedProjectId) : Promise.resolve([]),
    enabled: !!selectedProjectId,
  });

  // Group events by category and extract available years
  const eventsByCategory = new Map<string, any>();
  const availableEventYears = new Set<number>();
  allEventsData.forEach((event) => {
    const catId = event.category_id;
    availableEventYears.add(event.fiscal_year);
    if (!eventsByCategory.has(catId)) {
      eventsByCategory.set(catId, {
        id: catId,
        name: event.category?.name || "Unknown",
        rates: {},
      });
    }
    eventsByCategory.get(catId).rates[event.fiscal_year] = event;
  });
  const eventMatrix = Array.from(eventsByCategory.values());

  // Get available years for projects
  const availableProjectYears = new Set(projectAllocations.map((a) => a.allocation_year));

  // Combine all available years
  const allAvailableYears = Array.from(
    new Set([...availableEventYears, ...availableProjectYears]),
  ).sort((a, b) => a - b);

  // Get display years based on filter (only show available years)
  const displayYears = Array.from(eventYearsFilter)
    .filter((y) => allAvailableYears.includes(y))
    .sort((a, b) => a - b);

  const invalidateQueries = () => {
    qc.invalidateQueries({ queryKey: ["parish-classes"] });
    qc.invalidateQueries({ queryKey: ["all-events"] });
    qc.invalidateQueries({ queryKey: ["enrollment-rate"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project-allocations"] });
  };

  const handleDeleteClass = async (id: string) => {
    try {
      await deleteParishClass(id);
      toast.success("Class deleted");
      setDeleteConfirm({ open: false });
      invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteEvent(id);
      toast.success("Event and all its rates deleted");
      setDeleteConfirm({ open: false });
      invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject(id);
      toast.success("Project deleted");
      setDeleteConfirm({ open: false });
      invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteAllocation = async (id: string) => {
    try {
      await deleteProjectAllocation(id);
      toast.success("Allocation deleted");
      setDeleteConfirm({ open: false });
      invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <Topbar
        title="Finance Configuration"
        description="Plan budgets and set financial obligations."
        tabs={
          <>
            <TopbarTab active={tab === "parish-classes"} onClick={() => setTab("parish-classes")}>
              Parish Classes
            </TopbarTab>
            <TopbarTab active={tab === "events"} onClick={() => setTab("events")}>
              Events
            </TopbarTab>
            <TopbarTab active={tab === "enrollment"} onClick={() => setTab("enrollment")}>
              Enrollment
            </TopbarTab>
            <TopbarTab active={tab === "projects"} onClick={() => setTab("projects")}>
              Projects
            </TopbarTab>
          </>
        }
        action={
          <button
            type="button"
            onClick={() => {
              if (tab === "parish-classes") setClassModal({ open: true });
              else if (tab === "events") setEventModal({ open: true });
              else if (tab === "enrollment") setEnrollmentModal(true);
              else if (tab === "projects") setProjectModal({ open: true });
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground transition hover:opacity-90"
          >
            <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> Add
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Card>
          <CardBody className="p-4">
            {tab === "parish-classes" && (
              <ParishClassesTab
                classes={parishClasses}
                onAdd={() => setClassModal({ open: true })}
                onEdit={(cls) => setClassModal({ open: true, edit: cls })}
                onDelete={(id) => setDeleteConfirm({ open: true, type: "class", id })}
                onSaved={invalidateQueries}
              />
            )}

            {tab === "events" && (
              <EventsTab
                eventMatrix={eventMatrix}
                yearsFilter={eventYearsFilter}
                onYearsFilterChange={setEventYearsFilter}
                onAddEvent={() => setEventModal({ open: true })}
                onAddYear={() => setYearModal(true)}
                onEditEvent={(evt) => setEventModal({ open: true, edit: evt })}
                onDeleteEvent={(id) => setDeleteConfirm({ open: true, type: "event", id })}
                onSaved={invalidateQueries}
                availableYears={allAvailableYears}
              />
            )}

            {tab === "enrollment" && (
              <EnrollmentTab
                rate={enrollmentRate}
                selectedYear={selectedEnrollmentYear}
                onYearChange={setSelectedEnrollmentYear}
                onEdit={() => setEnrollmentModal(true)}
                onSaved={invalidateQueries}
              />
            )}

            {tab === "projects" && (
              <ProjectsTab
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                allocations={projectAllocations}
                classes={parishClasses}
                yearsFilter={eventYearsFilter}
                availableYears={allAvailableYears}
                onAddProject={() => setProjectModal({ open: true })}
                onEditProject={(proj) => setProjectModal({ open: true, edit: proj })}
                onDeleteProject={(id) => setDeleteConfirm({ open: true, type: "project", id })}
                onAddAllocation={() => setAllocationModal({ open: true })}
                onEditAllocation={(alloc) => setAllocationModal({ open: true, edit: alloc })}
                onDeleteAllocation={(id) =>
                  setDeleteConfirm({ open: true, type: "allocation", id })
                }
                onSaved={invalidateQueries}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Dialogs */}
      <ClassFormDialog
        open={classModal.open}
        edit={classModal.edit}
        onOpenChange={(o) => setClassModal({ open: o })}
        onSaved={invalidateQueries}
      />
      <EventFormDialog
        open={eventModal.open}
        edit={eventModal.edit}
        onOpenChange={(o) => setEventModal({ open: o })}
        onSaved={invalidateQueries}
      />
      <AddYearDialog open={yearModal} onOpenChange={setYearModal} onSaved={invalidateQueries} />
      <EnrollmentFormDialog
        open={enrollmentModal}
        onOpenChange={setEnrollmentModal}
        year={selectedEnrollmentYear}
        onSaved={invalidateQueries}
      />
      <ProjectFormDialog
        open={projectModal.open}
        edit={projectModal.edit}
        onOpenChange={(o) => setProjectModal({ open: o })}
        onSaved={invalidateQueries}
      />
      <AllocationFormDialog
        open={allocationModal.open}
        edit={allocationModal.edit}
        projectId={selectedProjectId}
        onOpenChange={(o) => setAllocationModal({ open: o })}
        onSaved={invalidateQueries}
      />
      <ConfirmDialog
        open={deleteConfirm.open}
        type={deleteConfirm.type}
        id={deleteConfirm.id}
        onOpenChange={(o) => setDeleteConfirm({ open: o })}
        onConfirm={() => {
          if (!deleteConfirm.id || !deleteConfirm.type) return;
          if (deleteConfirm.type === "class") handleDeleteClass(deleteConfirm.id);
          else if (deleteConfirm.type === "event") handleDeleteEvent(deleteConfirm.id);
          else if (deleteConfirm.type === "project") handleDeleteProject(deleteConfirm.id);
          else if (deleteConfirm.type === "allocation") handleDeleteAllocation(deleteConfirm.id);
        }}
      />
    </>
  );
}

// ============ TAB COMPONENTS ============

function ParishClassesTab({
  classes,
  onAdd,
  onEdit,
  onDelete,
  onSaved,
}: {
  classes: any[];
  onAdd: () => void;
  onEdit: (cls: any) => void;
  onDelete: (id: string) => void;
  onSaved: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-text-3">
          Define parish tiers for tiered project allocations.
        </div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="label-eyebrow px-3.5 py-2.5 text-left">Class Name</th>
            <th className="label-eyebrow px-3.5 py-2.5 text-left">Description</th>
            <th className="label-eyebrow px-3.5 py-2.5 text-right w-[60px]">Menu</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((cls) => (
            <tr key={cls.id} className="border-b border-border/30 hover:bg-bg-3">
              <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                {cls.class_name}
              </td>
              <td className="px-3.5 py-2.5 text-[11px] text-text-2">{cls.description || "—"}</td>
              <td className="px-3.5 py-2.5 text-right">
                <RowMenu
                  items={[
                    { label: "Edit", icon: "mdi:pencil", action: () => onEdit(cls) },
                    { label: "Delete", icon: "mdi:trash", action: () => onDelete(cls.id) },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventsTab({
  eventMatrix,
  yearsFilter,
  onYearsFilterChange,
  onAddEvent,
  onAddYear,
  onEditEvent,
  onDeleteEvent,
  onSaved,
  availableYears,
}: {
  eventMatrix: any[];
  yearsFilter: Set<number>;
  onYearsFilterChange: (years: Set<number>) => void;
  onAddEvent: () => void;
  onAddYear: () => void;
  onEditEvent: (evt: any) => void;
  onDeleteEvent: (id: string) => void;
  onSaved: () => void;
  availableYears: number[];
}) {
  const displayYears = Array.from(yearsFilter)
    .filter((y) => availableYears.includes(y))
    .sort((a, b) => a - b);

  const handleSelectAll = () => {
    onYearsFilterChange(new Set(availableYears));
  };

  const handleClearAll = () => {
    onYearsFilterChange(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-text-3">Event rates by year</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAddEvent}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground hover:opacity-90"
          >
            <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> Add Event
          </button>
          <button
            type="button"
            onClick={onAddYear}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground hover:opacity-90"
          >
            <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> Add Year
          </button>
        </div>
      </div>

      {/* Year Filter Dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-bold text-text-3">Filter Years:</label>
        <select
          multiple
          value={displayYears.map(String)}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, (opt) => parseInt(opt.value, 10));
            onYearsFilterChange(new Set(selected));
          }}
          className="h-8 rounded-md border border-border bg-bg-2 px-2 text-[11px] font-semibold text-text-1"
          size={1}
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-[10px] font-semibold text-primary hover:underline"
        >
          All
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          className="text-[10px] font-semibold text-text-3 hover:underline"
        >
          Clear
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="label-eyebrow px-3.5 py-2.5 text-left min-w-[150px]">Event</th>
              {displayYears.map((year) => (
                <th key={year} className="label-eyebrow px-3.5 py-2.5 text-center">
                  {year}
                </th>
              ))}
              <th className="label-eyebrow px-3.5 py-2.5 text-right w-[60px]">Menu</th>
            </tr>
          </thead>
          <tbody>
            {eventMatrix.map((event) => (
              <tr key={event.id} className="border-b border-border/30 hover:bg-bg-3">
                <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                  {event.name}
                </td>
                {displayYears.map((year) => {
                  const rate = event.rates[year];
                  return (
                    <EventCell
                      key={`${event.id}-${year}`}
                      rate={rate}
                      onEdit={() =>
                        onEditEvent({
                          event,
                          year,
                          rate,
                        })
                      }
                    />
                  );
                })}
                <td className="px-3.5 py-2.5 text-right">
                  <RowMenu
                    items={[
                      {
                        label: "Edit",
                        icon: "mdi:pencil",
                        action: () => onEditEvent(event),
                      },
                      {
                        label: "Delete",
                        icon: "mdi:trash",
                        action: () => onDeleteEvent(event.id),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventCell({ rate, onEdit }: { rate?: any; onEdit?: () => void }) {
  return (
    <td
      className="px-3.5 py-2.5 text-center text-[11px] text-foreground cursor-pointer hover:bg-bg-2"
      onClick={onEdit}
    >
      {rate ? (
        <span className="font-mono font-semibold">
          {parseInt(rate.amount_due).toLocaleString()}
        </span>
      ) : (
        <span className="text-text-4">—</span>
      )}
    </td>
  );
}

function EnrollmentTab({
  rate,
  selectedYear,
  onYearChange,
  onEdit,
  onSaved,
}: {
  rate: any;
  selectedYear: number;
  onYearChange: (year: number) => void;
  onEdit: () => void;
  onSaved: () => void;
}) {
  return (
    <div className="space-y-4 max-w-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-bold text-text-3">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(parseInt(e.target.value, 10))}
            className="h-8 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1"
          >
            {YEAR_RANGE.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-[10px] font-bold text-primary hover:text-primary/80"
        >
          Edit
        </button>
      </div>

      <div className="rounded-lg border border-border bg-bg-2 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-text-3 mb-2">
          Amount per Member (KES)
        </div>
        <div className="text-2xl font-black text-foreground">
          {rate ? parseInt(rate.amount_per_member).toLocaleString() : "—"}
        </div>
      </div>
    </div>
  );
}

function ProjectsTab({
  projects,
  selectedProjectId,
  onSelectProject,
  allocations,
  classes,
  yearsFilter,
  availableYears,
  onAddProject,
  onEditProject,
  onDeleteProject,
  onAddAllocation,
  onEditAllocation,
  onDeleteAllocation,
  onSaved,
}: {
  projects: any[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  allocations: any[];
  classes: any[];
  yearsFilter: Set<number>;
  availableYears: number[];
  onAddProject: () => void;
  onEditProject: (proj: any) => void;
  onDeleteProject: (id: string) => void;
  onAddAllocation: () => void;
  onEditAllocation: (alloc: any) => void;
  onDeleteAllocation: (id: string) => void;
  onSaved: () => void;
}) {
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // For allocation matrix, only show years that have allocations for this project
  const projectAllocationYears = new Set(allocations.map((a) => a.allocation_year));
  const displayYears = Array.from(yearsFilter)
    .filter((y) => projectAllocationYears.has(y))
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Projects Table */}
      <div className="space-y-4">
        <div className="text-[12px] text-text-3">Select a project to view/edit allocations</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="label-eyebrow px-3.5 py-2.5 text-left">Project Name</th>
                <th className="label-eyebrow px-3.5 py-2.5 text-left">Status</th>
                <th className="label-eyebrow px-3.5 py-2.5 text-left">Description</th>
                <th className="label-eyebrow px-3.5 py-2.5 text-right w-[60px]">Menu</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className={`border-b border-border/30 cursor-pointer ${
                    selectedProjectId === project.id ? "bg-bg-2" : "hover:bg-bg-3"
                  }`}
                  onClick={() =>
                    onSelectProject(selectedProjectId === project.id ? null : project.id)
                  }
                >
                  <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                    {project.name}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded ${
                        project.status === "active"
                          ? "bg-success-soft text-success"
                          : "bg-text-4 text-text-3"
                      }`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-[11px] text-text-2">
                    {project.description || "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <RowMenu
                      items={[
                        { label: "Edit", action: () => onEditProject(project) },
                        { label: "Delete", action: () => onDeleteProject(project.id) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation Matrix */}
      {selectedProject && (
        <div className="space-y-4 border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-bold text-foreground">
              {selectedProject.name} Allocation Matrix
            </div>
            <button
              type="button"
              onClick={onAddAllocation}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground hover:opacity-90"
            >
              <Icon icon="mdi:plus" className="h-3.5 w-3.5" /> Add Allocation
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="label-eyebrow px-3.5 py-2.5 text-left min-w-[120px]">Class</th>
                  {displayYears.map((year) => {
                    const yearAllocations = allocations.filter((a) => a.allocation_year === year);
                    return (
                      <th
                        key={year}
                        className="label-eyebrow px-3.5 py-2.5 text-center group relative"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>{year}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (yearAllocations.length > 0) {
                                yearAllocations.forEach((a) => onDeleteAllocation(a.id));
                              } else {
                                toast.info(`No allocations to delete for ${year}`);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            title={`Delete all allocations for ${year}`}
                          >
                            <Icon
                              icon="mdi:trash"
                              className="h-3 w-3 text-text-3 hover:text-danger"
                            />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  <th className="label-eyebrow px-3.5 py-2.5 text-right w-[60px]">Menu</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <tr key={cls.id} className="border-b border-border/30 hover:bg-bg-3">
                    <td className="px-3.5 py-2.5 text-[11px] font-semibold text-foreground">
                      {cls.class_name}
                    </td>
                    {displayYears.map((year) => {
                      const alloc = allocations.find(
                        (a) => a.class_id === cls.id && a.allocation_year === year,
                      );
                      return (
                        <AllocationCell
                          key={`${cls.id}-${year}`}
                          allocation={alloc}
                          class={cls}
                          year={year}
                          onEdit={() =>
                            onEditAllocation({
                              allocation: alloc,
                              class: cls,
                              year,
                            })
                          }
                          onDelete={() => alloc && onDeleteAllocation(alloc.id)}
                        />
                      );
                    })}
                    <td className="px-3.5 py-2.5 text-right" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AllocationCell({
  allocation,
  class: cls,
  year,
  onEdit,
  onDelete,
}: {
  allocation?: any;
  class?: any;
  year?: number;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <td
      className="px-3.5 py-2.5 text-center text-[11px] text-foreground cursor-pointer hover:bg-bg-2 group relative"
      onClick={onEdit}
    >
      {allocation ? (
        <>
          <span className="font-mono font-semibold">
            {parseInt(allocation.amount_allocated).toLocaleString()}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete this allocation"
            >
              <Icon icon="mdi:trash" className="h-3.5 w-3.5 text-text-3 hover:text-danger" />
            </button>
          )}
        </>
      ) : (
        <span className="text-text-4">—</span>
      )}
    </td>
  );
}

// ============ UTILITY COMPONENTS ============

function MultiSelectYearsDropdown({
  selected,
  onChange,
}: {
  selected: Set<number>;
  onChange: (years: Set<number>) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggleYear = (year: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(year)) {
      newSelected.delete(year);
    } else {
      newSelected.add(year);
    }
    onChange(newSelected);
  };

  const selectedCount = selected.size;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-8 w-full rounded-md border border-border bg-bg-2 px-2.5 text-left text-[11px] font-semibold text-text-1 flex items-center justify-between"
      >
        <span>{selectedCount > 0 ? `${selectedCount} years selected` : "Select years"}</span>
        <span className="text-[8px]">▼</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {YEAR_RANGE.map((year) => (
            <label
              key={year}
              className="flex items-center gap-2 px-3 py-2 hover:bg-bg-2 cursor-pointer text-[11px]"
            >
              <input
                type="checkbox"
                checked={selected.has(year)}
                onChange={() => toggleYear(year)}
                className="rounded border border-border"
              />
              <span className="font-semibold text-text-1">{year}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function RowMenu({ items }: { items: { label: string; icon?: string; action: () => void }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-[14px] font-bold text-text-3 hover:text-foreground h-5 w-5 flex items-center justify-center"
          title="Actions"
        >
          ⋮
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} onClick={item.action}>
            {item.icon && <Icon icon={item.icon} className="h-3.5 w-3.5 mr-2 shrink-0" />}
            <span>{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============ FORM DIALOGS ============

function ClassFormDialog({
  open,
  edit,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  edit?: any;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [className, setClassName] = useState(edit?.class_name ?? "");
  const [description, setDescription] = useState(edit?.description ?? "");

  useEffect(() => {
    if (open) {
      setClassName(edit?.class_name ?? "");
      setDescription(edit?.description ?? "");
    }
  }, [open, edit]);

  const createMut = useMutation({
    mutationFn: () => createParishClass({ class_name: className, description }),
    onSuccess: () => {
      toast.success("Class created");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => updateParishClass(edit.id, { class_name: className, description }),
    onSuccess: () => {
      toast.success("Class updated");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">
            {edit ? "Edit Class" : "Add Parish Class"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
              Class Name *
            </span>
            <Input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Class A"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
              Description
            </span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Large/Urban parishes"
            />
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => (edit ? updateMut.mutate() : createMut.mutate())}
            disabled={createMut.isPending || updateMut.isPending || !className}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {edit ? "Update" : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventFormDialog({
  open,
  edit,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  edit?: any;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  // Determine edit type: cell-based (has year) vs full event (no year)
  const isCellEdit = edit?.year !== undefined;
  const isFullEventEdit = edit && !isCellEdit;

  const [eventName, setEventName] = useState(
    isCellEdit ? (edit?.event?.name ?? "") : (edit?.category?.name ?? ""),
  );
  const [amount, setAmount] = useState(
    isCellEdit ? (edit?.rate?.amount_due ?? "") : (edit?.amount_due ?? ""),
  );
  const [selectedYears, setSelectedYears] = useState<Set<number>>(
    new Set(isCellEdit ? [edit?.year] : isFullEventEdit ? [edit?.fiscal_year] : [YEAR_RANGE[0]]),
  );
  const currentYear = isCellEdit ? edit?.year : undefined;

  useEffect(() => {
    if (open) {
      setEventName(isCellEdit ? (edit?.event?.name ?? "") : (edit?.category?.name ?? ""));
      setAmount(isCellEdit ? (edit?.rate?.amount_due ?? "") : (edit?.amount_due ?? ""));
      if (!edit) {
        setSelectedYears(new Set([YEAR_RANGE[0]]));
      }
    }
  }, [open, edit, isCellEdit]);

  const createMut = useMutation({
    mutationFn: async () => {
      for (const year of Array.from(selectedYears)) {
        await createEvent({ name: eventName, fiscalYear: year, amount });
      }
    },
    onSuccess: () => {
      toast.success("Event created");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (isCellEdit) {
        if (edit?.rate?.id) {
          // Update existing rate
          await updateEventRate(edit.rate.id, amount);
        } else {
          // Create new rate for this event/year
          const { data: eventRates } = await supabase
            .from("event_rates")
            .select("*")
            .eq("category_id", edit.event.id)
            .eq("fiscal_year", currentYear)
            .single();

          if (!eventRates) {
            // Insert new rate
            const { error } = await supabase.from("event_rates").insert([
              {
                category_id: edit.event.id,
                fiscal_year: currentYear,
                amount_due: amount,
              },
            ]);
            if (error) throw new Error(`Failed to create rate: ${error.message}`);
          }
        }
      } else {
        // Full event edit
        await updateEventRate(edit.id, amount);
      }
    },
    onSuccess: () => {
      toast.success(isCellEdit ? "Rate updated" : "Event updated");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-white max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">
            {isCellEdit
              ? `Edit Rate: ${eventName} (${currentYear})`
              : isFullEventEdit
                ? "Edit Event Rate"
                : "Add Event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
              Event Name
            </span>
            <Input value={eventName} disabled className="opacity-75" />
          </label>

          {isCellEdit && (
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
                Fiscal Year
              </span>
              <Input value={currentYear} disabled className="opacity-75" />
            </label>
          )}

          {!isCellEdit && !isFullEventEdit && (
            <div className="block space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
                Apply to Years *
              </span>
              <MultiSelectYearsDropdown selected={selectedYears} onChange={setSelectedYears} />
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
              Amount (KES) *
            </span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1500"
            />
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => (edit || isCellEdit ? updateMut.mutate() : createMut.mutate())}
            disabled={
              createMut.isPending ||
              updateMut.isPending ||
              !amount ||
              (!edit && !isCellEdit && (!eventName || selectedYears.size === 0))
            }
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {edit || isCellEdit ? "Update" : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddYearDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [newYears, setNewYears] = useState<Set<number>>(new Set());
  const [copyFromYear, setCopyFromYear] = useState<number | null>(null);
  const [copyAllEvents, setCopyAllEvents] = useState(true);

  useEffect(() => {
    if (open) {
      setNewYears(new Set());
      setCopyFromYear(null);
      setCopyAllEvents(true);
    }
  }, [open]);

  const copyMut = useMutation({
    mutationFn: async () => {
      const yearArray = Array.from(newYears);

      for (const year of yearArray) {
        if (copyFromYear && copyAllEvents) {
          // Copy all event rates from source year
          const { data: eventRates } = await supabase
            .from("event_rates")
            .select("*")
            .eq("fiscal_year", copyFromYear);

          if (eventRates && eventRates.length > 0) {
            const eventRateRows = eventRates.map((row: any) => ({
              category_id: row.category_id,
              fiscal_year: year,
              amount_due: row.amount_due,
            }));

            const { error: eventError } = await supabase.from("event_rates").insert(eventRateRows);

            if (eventError) throw new Error(`Failed to copy event rates: ${eventError.message}`);
          }

          // Copy all project allocations from source year
          const { data: allocations } = await supabase
            .from("project_class_allocations")
            .select("*")
            .eq("allocation_year", copyFromYear);

          if (allocations && allocations.length > 0) {
            const allocationRows = allocations.map((row: any) => ({
              project_id: row.project_id,
              class_id: row.class_id,
              allocation_year: year,
              amount_allocated: row.amount_allocated,
            }));

            const { error: allocError } = await supabase
              .from("project_class_allocations")
              .insert(allocationRows);

            if (allocError) throw new Error(`Failed to copy allocations: ${allocError.message}`);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Years added");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">Add Year</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="block space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
              Select Years *
            </span>
            <MultiSelectYearsDropdown selected={newYears} onChange={setNewYears} />
          </div>

          <div className="block space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
              Copy From Year
            </span>
            <select
              value={copyFromYear ?? ""}
              onChange={(e) =>
                setCopyFromYear(e.target.value ? parseInt(e.target.value, 10) : null)
              }
              className="w-full h-8 rounded-md border border-border bg-bg-2 px-2 text-[11px] font-semibold text-text-1"
            >
              <option value="">None</option>
              {YEAR_RANGE.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={copyAllEvents}
              onChange={(e) => setCopyAllEvents(e.target.checked)}
              className="rounded border border-border"
            />
            <span className="text-[11px] font-semibold text-text-1">
              Copy all events from {copyFromYear}
            </span>
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => copyMut.mutate()}
            disabled={copyMut.isPending || newYears.size === 0}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            Add Years
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnrollmentFormDialog({
  open,
  onOpenChange,
  year,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  onSaved: () => void;
}) {
  const { data: rate } = useQuery({
    queryKey: ["enrollment-rate", year],
    queryFn: () => getEnrollmentRate(year),
  });

  const [amount, setAmount] = useState("100");

  useEffect(() => {
    if (rate?.amount_per_member) {
      setAmount(rate.amount_per_member);
    }
  }, [rate]);

  const updateMut = useMutation({
    mutationFn: () => updateEnrollmentRate(year, amount),
    onSuccess: () => {
      toast.success("Enrollment rate updated");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">
            Set Enrollment Rate ({year})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
              Amount per Member (KES) *
            </span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
            />
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => updateMut.mutate()}
            disabled={updateMut.isPending || !amount}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectFormDialog({
  open,
  edit,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  edit?: any;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [projectName, setProjectName] = useState(edit?.name ?? "");
  const [description, setDescription] = useState(edit?.description ?? "");
  const [status, setStatus] = useState<"draft" | "active" | "closed">(edit?.status ?? "draft");

  useEffect(() => {
    if (open) {
      setProjectName(edit?.name ?? "");
      setDescription(edit?.description ?? "");
      setStatus(edit?.status ?? "draft");
    }
  }, [open, edit]);

  const createMut = useMutation({
    mutationFn: () => createProject({ name: projectName, description }),
    onSuccess: () => {
      toast.success("Project created");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => updateProject(edit.id, { name: projectName, description, status }),
    onSuccess: () => {
      toast.success("Project updated");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">
            {edit ? "Edit Project" : "Add Project"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
              Project Name *
            </span>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Kagio Youth Complex"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
              Description
            </span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project details"
            />
          </label>

          {edit && (
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="h-8 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 w-full"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => (edit ? updateMut.mutate() : createMut.mutate())}
            disabled={createMut.isPending || updateMut.isPending || !projectName}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {edit ? "Update" : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllocationFormDialog({
  open,
  edit,
  projectId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  edit?: any;
  projectId: string | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { data: classes = [] } = useQuery({
    queryKey: ["parish-classes"],
    queryFn: listParishClasses,
  });

  // Determine edit type: cell-based (has class+year) vs full allocation form (no class+year)
  const isCellEdit = edit?.class !== undefined && edit?.year !== undefined;
  const isFullEdit = edit?.allocation !== undefined && !isCellEdit;

  const [classId, setClassId] = useState(
    isCellEdit ? (edit?.class?.id ?? "") : (edit?.class_id ?? ""),
  );
  const [year, setYear] = useState(
    isCellEdit ? (edit?.year ?? YEAR_RANGE[0]) : (edit?.allocation_year ?? YEAR_RANGE[0]),
  );
  const [amount, setAmount] = useState(
    isCellEdit ? (edit?.allocation?.amount_allocated ?? "") : (edit?.amount_allocated ?? ""),
  );

  useEffect(() => {
    if (open) {
      setClassId(isCellEdit ? (edit?.class?.id ?? "") : (edit?.class_id ?? ""));
      setYear(
        isCellEdit ? (edit?.year ?? YEAR_RANGE[0]) : (edit?.allocation_year ?? YEAR_RANGE[0]),
      );
      setAmount(
        isCellEdit ? (edit?.allocation?.amount_allocated ?? "") : (edit?.amount_allocated ?? ""),
      );
    }
  }, [open, edit, isCellEdit]);

  const createMut = useMutation({
    mutationFn: () =>
      createProjectAllocation({
        projectId: projectId!,
        classId,
        allocationYear: year,
        amountAllocated: amount,
      }),
    onSuccess: () => {
      toast.success("Allocation created");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (isCellEdit) {
        if (edit.allocation?.id) {
          // Update existing allocation
          await updateProjectAllocation(edit.allocation.id, amount);
        } else {
          // Create new allocation for empty cell
          await createProjectAllocation({
            projectId: projectId!,
            classId: edit.class.id,
            allocationYear: edit.year,
            amountAllocated: amount,
          });
        }
      } else {
        // Full edit mode
        await updateProjectAllocation(edit.id, amount);
      }
    },
    onSuccess: () => {
      toast.success(
        isCellEdit && !edit.allocation?.id ? "Allocation created" : "Allocation updated",
      );
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">
            {isCellEdit
              ? `Edit Allocation: ${selectedClass?.class_name} (${year})`
              : isFullEdit
                ? "Edit Allocation"
                : "Add Allocation"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isCellEdit && (
            <>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
                  Class *
                </span>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  disabled={isFullEdit}
                  className="h-8 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 w-full disabled:opacity-75"
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
                  Year *
                </span>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10))}
                  disabled={isFullEdit}
                  className="h-8 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 w-full disabled:opacity-75"
                >
                  {YEAR_RANGE.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {isCellEdit && (
            <>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
                  Parish Class
                </span>
                <Input value={selectedClass?.class_name ?? ""} disabled className="opacity-75" />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
                  Fiscal Year
                </span>
                <Input value={year} disabled className="opacity-75" />
              </label>
            </>
          )}

          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">
              Amount (KES) *
            </span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
            />
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              isCellEdit || isFullEdit || edit?.allocation ? updateMut.mutate() : createMut.mutate()
            }
            disabled={
              createMut.isPending ||
              updateMut.isPending ||
              !amount ||
              (!isCellEdit && !isFullEdit && !edit && !classId)
            }
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isCellEdit ? (edit?.allocation ? "Update" : "Create") : edit ? "Update" : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({
  open,
  type,
  id,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  type?: string;
  id?: string;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-danger">Delete {type}</DialogTitle>
        </DialogHeader>

        <p className="text-[12px] text-text-2">
          Are you sure you want to delete this {type}? This action cannot be undone.
        </p>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="rounded-lg bg-danger px-4 py-2 text-[11px] font-bold text-white hover:opacity-90"
          >
            Delete
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
