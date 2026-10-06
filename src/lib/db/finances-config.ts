import { supabase } from "@/integrations/supabase/client";

// ============ TYPES ============

export type ParishClass = {
  id: string;
  class_name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type EventRate = {
  id: string;
  category_id: string;
  fiscal_year: number;
  amount_due: string;
  category?: {
    id: string;
    name: string;
    type: "event" | "enrollment";
  };
};

export type EnrollmentRate = {
  id: string;
  fiscal_year: number;
  amount_per_member: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "closed";
  is_active: boolean;
};

export type ProjectClassAllocation = {
  id: string;
  project_id: string;
  class_id: string;
  allocation_year: number;
  amount_allocated: string;
};

// ============ PARISH CLASSES ============

export async function listParishClasses() {
  const { data, error } = await supabase.from("parish_classes").select("*").order("sort_order");

  if (error) throw new Error(`Failed to fetch parish classes: ${error.message}`);
  return data as ParishClass[];
}

export async function createParishClass(input: {
  class_name: string;
  description?: string;
  sort_order?: number;
}) {
  const { data, error } = await supabase.from("parish_classes").insert([input]).select().single();

  if (error) throw new Error(`Failed to create parish class: ${error.message}`);
  return data as ParishClass;
}

export async function updateParishClass(
  id: string,
  input: { class_name?: string; description?: string; sort_order?: number; is_active?: boolean },
) {
  const { data, error } = await supabase
    .from("parish_classes")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update parish class: ${error.message}`);
  return data as ParishClass;
}

export async function deleteParishClass(id: string) {
  const { error } = await supabase.from("parish_classes").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete parish class: ${error.message}`);
}

// ============ EVENT RATES ============

export async function listEventsByYear(fiscalYear: number) {
  const { data, error } = await supabase
    .from("event_rates")
    .select(
      `
      id, category_id, fiscal_year, amount_due,
      category:financial_categories(id, name, type)
    `,
    )
    .eq("fiscal_year", fiscalYear)
    .order("created_at");

  if (error) throw new Error(`Failed to fetch event rates: ${error.message}`);
  return data as EventRate[];
}

export async function listAllYears() {
  const { data, error } = await supabase
    .from("event_rates")
    .select("fiscal_year", { count: "exact" })
    .order("fiscal_year", { ascending: false });

  if (error) throw new Error(`Failed to fetch years: ${error.message}`);

  const years = [...new Set((data ?? []).map((r: any) => r.fiscal_year))].sort((a, b) => b - a);
  return years;
}

export async function createEvent(input: { name: string; fiscalYear: number; amount: string }) {
  // First, check if event category already exists (by name only, not year)
  const { data: existing } = await supabase
    .from("financial_categories")
    .select("id")
    .eq("name", input.name)
    .eq("type", "event")
    .limit(1)
    .single();

  let catId: string;

  if (existing) {
    // Reuse existing category
    catId = existing.id;
  } else {
    // Create new category (without fiscal_year constraint)
    const { data: category, error: catError } = await supabase
      .from("financial_categories")
      .insert([
        {
          name: input.name,
          type: "event",
          fiscal_year: input.fiscalYear,
        },
      ])
      .select()
      .single();

    if (catError) throw new Error(`Failed to create event category: ${catError.message}`);
    catId = category.id;
  }

  // Create event rate for this year
  const { data, error } = await supabase
    .from("event_rates")
    .insert([
      {
        category_id: catId,
        fiscal_year: input.fiscalYear,
        amount_due: input.amount,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`Failed to create event rate: ${error.message}`);
  return data as EventRate;
}

export async function updateEventRate(id: string, amount: string) {
  const { data, error } = await supabase
    .from("event_rates")
    .update({ amount_due: amount })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update event rate: ${error.message}`);
  return data as EventRate;
}

export async function deleteEventRate(id: string) {
  const { error } = await supabase.from("event_rates").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete event rate: ${error.message}`);
}

export async function deleteEvent(categoryId: string) {
  const { error: ratesError } = await supabase
    .from("event_rates")
    .delete()
    .eq("category_id", categoryId);

  if (ratesError) throw new Error(`Failed to delete event rates: ${ratesError.message}`);

  const { error: categoryError } = await supabase
    .from("financial_categories")
    .delete()
    .eq("id", categoryId);

  if (categoryError) throw new Error(`Failed to delete event category: ${categoryError.message}`);
}

// ============ ENROLLMENT RATES ============

export async function getEnrollmentRate(fiscalYear: number) {
  const { data, error } = await supabase
    .from("enrollment_rates")
    .select("*")
    .eq("fiscal_year", fiscalYear)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch enrollment rate: ${error.message}`);
  }

  return (data as EnrollmentRate) || null;
}

export async function updateEnrollmentRate(fiscalYear: number, amountPerMember: string) {
  const existing = await getEnrollmentRate(fiscalYear);

  if (existing) {
    const { data, error } = await supabase
      .from("enrollment_rates")
      .update({ amount_per_member: amountPerMember })
      .eq("fiscal_year", fiscalYear)
      .select()
      .single();

    if (error) throw new Error(`Failed to update enrollment rate: ${error.message}`);
    return data as EnrollmentRate;
  }

  const { data, error } = await supabase
    .from("enrollment_rates")
    .insert([{ fiscal_year: fiscalYear, amount_per_member: amountPerMember }])
    .select()
    .single();

  if (error) throw new Error(`Failed to create enrollment rate: ${error.message}`);
  return data as EnrollmentRate;
}

// ============ PROJECTS ============

export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Failed to fetch projects: ${error.message}`);
  return data as Project[];
}

export async function createProject(input: { name: string; description?: string }) {
  const { data, error } = await supabase
    .from("projects")
    .insert([{ ...input, status: "draft" }])
    .select()
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return data as Project;
}

export async function updateProject(
  id: string,
  input: { name?: string; description?: string; status?: "draft" | "active" | "closed" },
) {
  const { data, error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update project: ${error.message}`);
  return data as Project;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete project: ${error.message}`);
}

// ============ PROJECT CLASS ALLOCATIONS (MATRIX) ============

export async function getProjectAllocationMatrix(projectId: string) {
  const { data, error } = await supabase
    .from("project_class_allocations")
    .select("*")
    .eq("project_id", projectId)
    .order("allocation_year", { ascending: false })
    .order("created_at");

  if (error) throw new Error(`Failed to fetch allocations: ${error.message}`);
  return data as ProjectClassAllocation[];
}

export async function updateProjectAllocation(id: string, amountAllocated: string) {
  const { data, error } = await supabase
    .from("project_class_allocations")
    .update({ amount_allocated: amountAllocated })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update allocation: ${error.message}`);
  return data as ProjectClassAllocation;
}

export async function createProjectAllocation(input: {
  projectId: string;
  classId: string;
  allocationYear: number;
  amountAllocated: string;
}) {
  const { data, error } = await supabase
    .from("project_class_allocations")
    .insert([
      {
        project_id: input.projectId,
        class_id: input.classId,
        allocation_year: input.allocationYear,
        amount_allocated: input.amountAllocated,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`Failed to create allocation: ${error.message}`);
  return data as ProjectClassAllocation;
}

export async function deleteProjectAllocation(id: string) {
  const { error } = await supabase.from("project_class_allocations").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete allocation: ${error.message}`);
}

export async function bulkCreateAllocations(
  projectId: string,
  allocationYear: number,
  classAllocations: Array<{ classId: string; amount: string }>,
) {
  const rows = classAllocations.map((ca) => ({
    project_id: projectId,
    class_id: ca.classId,
    allocation_year: allocationYear,
    amount_allocated: ca.amount,
  }));

  const { data, error } = await supabase.from("project_class_allocations").insert(rows).select();

  if (error) throw new Error(`Failed to create allocations: ${error.message}`);
  return data as ProjectClassAllocation[];
}

export async function copyProjectAllocationYear(
  projectId: string,
  fromYear: number,
  toYear: number,
) {
  const { data: existing, error: fetchError } = await supabase
    .from("project_class_allocations")
    .select("*")
    .eq("project_id", projectId)
    .eq("allocation_year", fromYear);

  if (fetchError) throw new Error(`Failed to fetch source allocations: ${fetchError.message}`);

  const newRows = (existing ?? []).map((row: ProjectClassAllocation) => ({
    project_id: row.project_id,
    class_id: row.class_id,
    allocation_year: toYear,
    amount_allocated: row.amount_allocated,
  }));

  if (newRows.length === 0) return [];

  const { data, error } = await supabase.from("project_class_allocations").insert(newRows).select();

  if (error) throw new Error(`Failed to copy allocations: ${error.message}`);
  return data as ProjectClassAllocation[];
}

export async function copyAllProjectAllocationsYear(fromYear: number, toYear: number) {
  const { data: existing, error: fetchError } = await supabase
    .from("project_class_allocations")
    .select("*")
    .eq("allocation_year", fromYear);

  if (fetchError) throw new Error(`Failed to fetch source allocations: ${fetchError.message}`);

  const newRows = (existing ?? []).map((row: ProjectClassAllocation) => ({
    project_id: row.project_id,
    class_id: row.class_id,
    allocation_year: toYear,
    amount_allocated: row.amount_allocated,
  }));

  if (newRows.length === 0) return [];

  const { data, error } = await supabase.from("project_class_allocations").insert(newRows).select();

  if (error) throw new Error(`Failed to copy allocations: ${error.message}`);
  return data as ProjectClassAllocation[];
}
