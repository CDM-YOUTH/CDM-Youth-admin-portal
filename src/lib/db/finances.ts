import { supabase } from "@/integrations/supabase/client";
import { likePattern } from "@/lib/utils";

// ============ TYPES ============

export type FinancialCategory = {
  id: string;
  name: string;
  type: "event" | "project" | "enrollment";
  is_active: boolean;
};

export type ParishAssessment = {
  id: string;
  parish_id: string;
  category_id: string;
  fiscal_year: number;
  headcount: number | null;
  amount_due: string; // Numeric as string to preserve precision
  is_historical_arrears: boolean;
  category?: FinancialCategory;
  parish?: {
    id: string;
    name: string;
    deanery_id: string;
    deanery?: { name: string };
  };
};

export type ParishPayment = {
  id: string;
  parish_id: string;
  amount_paid: string;
  payment_method: "cheque" | "bank_deposit" | "cash";
  reference_number: string | null;
  payment_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
  parish?: {
    id: string;
    name: string;
    deanery_id: string;
    deanery?: { name: string };
  };
};

export type PaymentAllocation = {
  id: string;
  payment_id: string;
  assessment_id: string;
  allocated_amount: string;
};

// ============ FINANCIAL CATEGORIES ============

export async function listFinancialCategories(type?: "event" | "project" | "enrollment") {
  let query = supabase.from("financial_categories").select("*").eq("is_active", true);

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query.order("name");

  if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
  return data as FinancialCategory[];
}

export async function createFinancialCategory(input: {
  name: string;
  type: "event" | "project" | "enrollment";
}) {
  const { data, error } = await supabase
    .from("financial_categories")
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(`Failed to create category: ${error.message}`);
  return data as FinancialCategory;
}

// ============ PARISH ASSESSMENTS ============

export async function listParishAssessmentsPaged(params: {
  fiscalYear: number;
  deaneryId?: string | null;
  parishId?: string | null;
  page: number;
  size: number;
}) {
  const { fiscalYear, deaneryId, parishId, page, size } = params;

  let query = supabase
    .from("parish_assessments")
    .select(
      `
      id, parish_id, category_id, fiscal_year, headcount, amount_due, is_historical_arrears,
      category:financial_categories(id, name, type),
      parish:parishes(id, name, deanery_id, deanery:deaneries(name))
    `,
      { count: "exact" },
    )
    .eq("fiscal_year", fiscalYear);

  // Filter by deanery if specified (via parish -> deanery)
  if (deaneryId || parishId) {
    // Need to fetch parishes first and filter
    const { data: parishes } = await supabase
      .from("parishes")
      .select("id")
      .eq("deanery_id", deaneryId || "");

    const parishIds = parishes?.map((p) => p.id) ?? [];
    if (parishIds.length > 0) {
      query = query.in("parish_id", parishIds);
    }
  }

  const { data, count, error } = await query
    .order("parish_id")
    .range(page * size, (page + 1) * size - 1);

  if (error) throw new Error(`Failed to fetch assessments: ${error.message}`);

  return { data: data as ParishAssessment[], total: count ?? 0 };
}

export async function createParishAssessment(input: {
  parishId: string;
  categoryId: string;
  fiscalYear: number;
  headcount?: number | null;
  amountDue: string;
  isHistoricalArrears?: boolean;
}) {
  const { data, error } = await supabase
    .from("parish_assessments")
    .insert([
      {
        parish_id: input.parishId,
        category_id: input.categoryId,
        fiscal_year: input.fiscalYear,
        headcount: input.headcount ?? null,
        amount_due: input.amountDue,
        is_historical_arrears: input.isHistoricalArrears ?? false,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`Failed to create assessment: ${error.message}`);
  return data as ParishAssessment;
}

export async function updateParishAssessment(
  id: string,
  input: {
    headcount?: number | null;
    amountDue?: string;
    isHistoricalArrears?: boolean;
  },
) {
  const { data, error } = await supabase
    .from("parish_assessments")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update assessment: ${error.message}`);
  return data as ParishAssessment;
}

export async function deleteParishAssessment(id: string) {
  const { error } = await supabase.from("parish_assessments").delete().eq("id", id);

  if (error) throw new Error(`Failed to delete assessment: ${error.message}`);
}

// ============ PARISH PAYMENTS ============

export async function listParishPaymentsPaged(params: {
  parishId?: string | null;
  deaneryId?: string | null;
  page: number;
  size: number;
}) {
  const { parishId, deaneryId, page, size } = params;

  let query = supabase.from("parish_payments").select(
    `
      id, parish_id, amount_paid, payment_method, reference_number, payment_date, notes, created_at,
      parish:parishes(id, name, deanery_id, deanery:deaneries(name))
    `,
    { count: "exact" },
  );

  if (parishId) {
    query = query.eq("parish_id", parishId);
  } else if (deaneryId) {
    // Filter via deanery
    const { data: parishes } = await supabase
      .from("parishes")
      .select("id")
      .eq("deanery_id", deaneryId);

    const parishIds = parishes?.map((p) => p.id) ?? [];
    if (parishIds.length > 0) {
      query = query.in("parish_id", parishIds);
    }
  }

  const { data, count, error } = await query
    .order("payment_date", { ascending: false })
    .range(page * size, (page + 1) * size - 1);

  if (error) throw new Error(`Failed to fetch payments: ${error.message}`);

  return { data: data as ParishPayment[], total: count ?? 0 };
}

export async function createParishPayment(input: {
  parishId: string;
  amountPaid: string;
  paymentMethod: "cheque" | "bank_deposit" | "cash";
  referenceNumber?: string | null;
  paymentDate: string; // YYYY-MM-DD
  notes?: string | null;
  allocations?: Array<{ assessmentId: string; allocatedAmount: string }>;
}) {
  // Start a transaction by creating payment first
  const { data: payment, error: paymentError } = await supabase
    .from("parish_payments")
    .insert([
      {
        parish_id: input.parishId,
        amount_paid: input.amountPaid,
        payment_method: input.paymentMethod,
        reference_number: input.referenceNumber ?? null,
        payment_date: input.paymentDate,
        notes: input.notes ?? null,
      },
    ])
    .select()
    .single();

  if (paymentError) {
    throw new Error(`Failed to create payment: ${paymentError.message}`);
  }

  // Create allocations if provided
  if (input.allocations && input.allocations.length > 0) {
    const { error: allocError } = await supabase.from("payment_allocations").insert(
      input.allocations.map((a) => ({
        payment_id: payment.id,
        assessment_id: a.assessmentId,
        allocated_amount: a.allocatedAmount,
      })),
    );

    if (allocError) {
      // Clean up payment if allocations fail
      await supabase.from("parish_payments").delete().eq("id", payment.id);
      throw new Error(`Failed to create allocations: ${allocError.message}`);
    }
  }

  return payment as ParishPayment;
}

export async function updateParishPayment(
  id: string,
  input: {
    amountPaid?: string;
    paymentMethod?: "cheque" | "bank_deposit" | "cash";
    referenceNumber?: string | null;
    paymentDate?: string;
    notes?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("parish_payments")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update payment: ${error.message}`);
  return data as ParishPayment;
}

export async function deleteParishPayment(id: string) {
  const { error } = await supabase.from("parish_payments").delete().eq("id", id);

  if (error) throw new Error(`Failed to delete payment: ${error.message}`);
}

// ============ PAYMENT ALLOCATIONS ============

export async function listPaymentAllocations(paymentId: string) {
  const { data, error } = await supabase
    .from("payment_allocations")
    .select(
      `
      id, payment_id, assessment_id, allocated_amount,
      assessment:parish_assessments(
        id, amount_due, is_historical_arrears,
        category:financial_categories(name, type)
      )
    `,
    )
    .eq("payment_id", paymentId)
    .order("created_at");

  if (error) throw new Error(`Failed to fetch allocations: ${error.message}`);
  return data as PaymentAllocation[];
}

export async function updatePaymentAllocation(id: string, allocatedAmount: string) {
  const { data, error } = await supabase
    .from("payment_allocations")
    .update({ allocated_amount: allocatedAmount })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update allocation: ${error.message}`);
  return data as PaymentAllocation;
}

export async function deletePaymentAllocation(id: string) {
  const { error } = await supabase.from("payment_allocations").delete().eq("id", id);

  if (error) throw new Error(`Failed to delete allocation: ${error.message}`);
}

// ============ ARREARS AGGREGATIONS ============

export type ArrearsAggregation = {
  currentArrears: number; // Current fiscal year obligations - payments
  previousArrears: number; // Sum of all prior year arrears
  totalBalance: number; // currentArrears + previousArrears
};

export async function getParishArrears(
  parishId: string,
  currentFiscalYear: number,
): Promise<ArrearsAggregation> {
  // Get current year assessments
  const { data: currentAssessments = [] } = await supabase
    .from("parish_assessments")
    .select("id, amount_due")
    .eq("parish_id", parishId)
    .eq("fiscal_year", currentFiscalYear);

  const currentDue = currentAssessments.reduce((sum, a: any) => sum + parseInt(a.amount_due || 0), 0);

  // Get payments for current year assessments
  const { data: currentPayments = [] } = await supabase
    .from("payment_allocations")
    .select("allocated_amount")
    .in(
      "assessment_id",
      currentAssessments.map((a: any) => a.id),
    );

  const currentPaid = currentPayments.reduce((sum, p: any) => sum + parseInt(p.allocated_amount || 0), 0);
  const currentArrears = Math.max(0, currentDue - currentPaid);

  // Get all prior year assessments
  const { data: priorAssessments = [] } = await supabase
    .from("parish_assessments")
    .select("id, amount_due")
    .eq("parish_id", parishId)
    .lt("fiscal_year", currentFiscalYear);

  const priorDue = priorAssessments.reduce((sum, a: any) => sum + parseInt(a.amount_due || 0), 0);

  // Get payments for prior year assessments
  const { data: priorPayments = [] } = await supabase
    .from("payment_allocations")
    .select("allocated_amount")
    .in(
      "assessment_id",
      priorAssessments.map((a: any) => a.id),
    );

  const priorPaid = priorPayments.reduce((sum, p: any) => sum + parseInt(p.allocated_amount || 0), 0);
  const previousArrears = Math.max(0, priorDue - priorPaid);

  return {
    currentArrears,
    previousArrears,
    totalBalance: currentArrears + previousArrears,
  };
}

// ============ SUMMARY ENDPOINTS ============

export type EventDetail = {
  id: string;
  name: string;
  amountDue: number;
  amountPaid: number;
  arrears: number;
};

export type ParishEventSummary = {
  id: string;
  name: string;
  events: EventDetail[];
  currentArrears: number;
  previousArrears: number;
  totalBalance: number;
};

export type DeaneryEventSummary = {
  id: string;
  name: string;
  events: EventDetail[];
  currentArrears: number;
  previousArrears: number;
  totalBalance: number;
  parishes: ParishEventSummary[];
};

export async function getEventsSummary(params: {
  year: number;
  deaneryId?: string | null;
  parishId?: string | null;
}) {
  const { year, deaneryId, parishId } = params;

  // ONE QUERY: Fetch all event assessments with related data
  let assessmentQuery = supabase
    .from("parish_assessments")
    .select(
      `
      id, parish_id, deanery_id, amount_due, amount_paid,
      category:financial_categories(id, name),
      parish:parishes(id, name, deanery_id, deanery:deaneries(id, name))
    `,
    )
    .eq("fiscal_year", year)
    .eq("category_type", "event");

  // Apply filter
  if (parishId) {
    assessmentQuery = assessmentQuery.eq("parish_id", parishId);
  } else if (deaneryId) {
    assessmentQuery = assessmentQuery.eq("deanery_id", deaneryId);
  }

  const { data: assessments = [] } = await assessmentQuery;

  if (!assessments.length) {
    return { summaries: [] };
  }

  // Build response - aggregate IN MEMORY, not with more queries
  if (parishId) {
    // Single parish
    const parish = assessments[0]?.parish;
    const events: EventDetail[] = assessments.map((a: any) => ({
      id: a.category.id,
      name: a.category.name,
      amountDue: parseInt(a.amount_due || 0),
      amountPaid: parseInt(a.amount_paid || 0),
      arrears: Math.max(0, parseInt(a.amount_due || 0) - parseInt(a.amount_paid || 0)),
    }));

    const currentArrears = events.reduce((sum, e) => sum + e.arrears, 0);

    return {
      summaries: [
        {
          id: parish?.id,
          name: parish?.name,
          events,
          currentArrears,
          previousArrears: 0,
          totalBalance: currentArrears,
        },
      ],
    };
  }

  // Group by deanery & parish in memory
  const deaneryMap = new Map<string, any>();

  assessments.forEach((a: any) => {
    const deanery = a.parish?.deanery;
    const parish = a.parish;
    const deaneryKey = a.deanery_id;  // Use direct column, not nested relationship

    if (!deaneryMap.has(deaneryKey)) {
      deaneryMap.set(deaneryKey, {
        id: deaneryKey,  // Use direct column value
        name: deanery?.name,  // Use nested relationship for name
        parishes: new Map(),
        eventMap: new Map(),
      });
    }

    const deaneryData = deaneryMap.get(deaneryKey);

    // Add to parish
    if (!deaneryData.parishes.has(parish.id)) {
      deaneryData.parishes.set(parish.id, {
        id: parish.id,
        name: parish.name,
        events: new Map(),
      });
    }

    const parishData = deaneryData.parishes.get(parish.id);

    // Aggregate event
    const eventKey = a.category.id;
    const eventAmount = {
      id: a.category.id,
      name: a.category.name,
      amountDue: parseInt(a.amount_due || 0),
      amountPaid: parseInt(a.amount_paid || 0),
    };

    if (parishData.events.has(eventKey)) {
      const existing = parishData.events.get(eventKey);
      existing.amountDue += eventAmount.amountDue;
      existing.amountPaid += eventAmount.amountPaid;
    } else {
      parishData.events.set(eventKey, eventAmount);
    }

    // Aggregate for deanery
    if (deaneryData.eventMap.has(eventKey)) {
      const existing = deaneryData.eventMap.get(eventKey);
      existing.amountDue += eventAmount.amountDue;
      existing.amountPaid += eventAmount.amountPaid;
    } else {
      deaneryData.eventMap.set(eventKey, { ...eventAmount });
    }
  });

  // Format response
  const summaries: DeaneryEventSummary[] = Array.from(deaneryMap.values()).map(
    (deaneryData) => {
      const parishSummaries: ParishEventSummary[] = Array.from(
        deaneryData.parishes.values(),
      ).map((parishData) => {
        const events = Array.from(parishData.events.values()).map((e: any) => ({
          ...e,
          arrears: Math.max(0, e.amountDue - e.amountPaid),
        }));
        const currentArrears = events.reduce((sum, e) => sum + e.arrears, 0);

        return {
          id: parishData.id,
          name: parishData.name,
          events,
          currentArrears,
          previousArrears: 0,
          totalBalance: currentArrears,
        };
      });

      const deaneryEvents = Array.from(deaneryData.eventMap.values()).map((e: any) => ({
        ...e,
        arrears: Math.max(0, e.amountDue - e.amountPaid),
      }));

      const deaneryCurrentArrears = parishSummaries.reduce(
        (sum, p) => sum + p.currentArrears,
        0,
      );

      return {
        id: deaneryData.id,
        name: deaneryData.name,
        events: deaneryEvents,
        currentArrears: deaneryCurrentArrears,
        previousArrears: 0,
        totalBalance: deaneryCurrentArrears,
        parishes: parishSummaries,
      };
    },
  );

  return { summaries: deaneryId ? summaries : summaries };
}

export async function getProjectsSummary(params: {
  year: number;
  deaneryId?: string | null;
  parishId?: string | null;
}) {
  const { year, deaneryId, parishId } = params;

  // ONE QUERY: Fetch all project assessments
  let assessmentQuery = supabase
    .from("parish_assessments")
    .select(
      `
      id, parish_id, deanery_id, amount_due, amount_paid,
      category:financial_categories(id, name),
      parish:parishes(id, name, deanery_id, deanery:deaneries(id, name))
    `,
    )
    .eq("fiscal_year", year)
    .eq("category_type", "project");

  if (parishId) {
    assessmentQuery = assessmentQuery.eq("parish_id", parishId);
  } else if (deaneryId) {
    assessmentQuery = assessmentQuery.eq("deanery_id", deaneryId);
  }

  const { data: assessments = [] } = await assessmentQuery;

  if (!assessments.length) {
    return { summaries: [] };
  }

  if (parishId) {
    const parish = assessments[0]?.parish;
    const projects: EventDetail[] = assessments.map((a: any) => ({
      id: a.category.id,
      name: a.category.name,
      amountDue: parseInt(a.amount_due || 0),
      amountPaid: parseInt(a.amount_paid || 0),
      arrears: Math.max(0, parseInt(a.amount_due || 0) - parseInt(a.amount_paid || 0)),
    }));

    const currentBalance = projects.reduce((sum, p) => sum + p.arrears, 0);

    return {
      summaries: [
        {
          id: parish?.id,
          name: parish?.name,
          projects,
          currentBalance,
          previousBalance: 0,
          totalBalance: currentBalance,
        },
      ],
    };
  }

  // Group in memory
  const deaneryMap = new Map<string, any>();

  assessments.forEach((a: any) => {
    const deanery = a.parish?.deanery;
    const parish = a.parish;
    const deaneryKey = a.deanery_id;  // Use direct column, not nested relationship

    if (!deaneryMap.has(deaneryKey)) {
      deaneryMap.set(deaneryKey, {
        id: deaneryKey,  // Use direct column value
        name: deanery?.name,  // Use nested relationship for name
        parishes: new Map(),
        projectMap: new Map(),
      });
    }

    const deaneryData = deaneryMap.get(deaneryKey);

    if (!deaneryData.parishes.has(parish.id)) {
      deaneryData.parishes.set(parish.id, {
        id: parish.id,
        name: parish.name,
        projects: new Map(),
      });
    }

    const parishData = deaneryData.parishes.get(parish.id);
    const projectKey = a.category.id;
    const projectAmount = {
      id: a.category.id,
      name: a.category.name,
      amountDue: parseInt(a.amount_due || 0),
      amountPaid: parseInt(a.amount_paid || 0),
    };

    if (parishData.projects.has(projectKey)) {
      const existing = parishData.projects.get(projectKey);
      existing.amountDue += projectAmount.amountDue;
      existing.amountPaid += projectAmount.amountPaid;
    } else {
      parishData.projects.set(projectKey, projectAmount);
    }

    if (deaneryData.projectMap.has(projectKey)) {
      const existing = deaneryData.projectMap.get(projectKey);
      existing.amountDue += projectAmount.amountDue;
      existing.amountPaid += projectAmount.amountPaid;
    } else {
      deaneryData.projectMap.set(projectKey, { ...projectAmount });
    }
  });

  const summaries = Array.from(deaneryMap.values()).map((deaneryData) => {
    const parishSummaries = Array.from(deaneryData.parishes.values()).map((parishData) => {
      const projects = Array.from(parishData.projects.values()).map((p: any) => ({
        ...p,
        arrears: Math.max(0, p.amountDue - p.amountPaid),
      }));
      const currentBalance = projects.reduce((sum, p) => sum + p.arrears, 0);

      return {
        id: parishData.id,
        name: parishData.name,
        projects,
        currentBalance,
        previousBalance: 0,
        totalBalance: currentBalance,
      };
    });

    const deaneryProjects = Array.from(deaneryData.projectMap.values()).map((p: any) => ({
      ...p,
      arrears: Math.max(0, p.amountDue - p.amountPaid),
    }));

    const deaneryCurrentBalance = parishSummaries.reduce(
      (sum, p) => sum + p.currentBalance,
      0,
    );

    return {
      id: deaneryData.id,
      name: deaneryData.name,
      projects: deaneryProjects,
      currentBalance: deaneryCurrentBalance,
      previousBalance: 0,
      totalBalance: deaneryCurrentBalance,
      parishes: parishSummaries,
    };
  });

  return { summaries };
}

export async function getEnrollmentSummary(params: {
  year: number;
  deaneryId?: string | null;
  parishId?: string | null;
}) {
  const { year, deaneryId, parishId } = params;

  // ONE QUERY: Fetch all enrollment assessments
  let assessmentQuery = supabase
    .from("parish_assessments")
    .select(
      `
      id, parish_id, deanery_id, amount_due, amount_paid, headcount,
      category:financial_categories(id, name),
      parish:parishes(id, name, deanery_id, deanery:deaneries(id, name))
    `,
    )
    .eq("fiscal_year", year)
    .eq("category_type", "enrollment");

  if (parishId) {
    assessmentQuery = assessmentQuery.eq("parish_id", parishId);
  } else if (deaneryId) {
    assessmentQuery = assessmentQuery.eq("deanery_id", deaneryId);
  }

  const { data: assessments = [] } = await assessmentQuery;

  if (!assessments.length) {
    return { summaries: [] };
  }

  if (parishId) {
    const parish = assessments[0]?.parish;
    const totalEnrolled = assessments.reduce((sum, a) => sum + (a.headcount || 0), 0);
    const totalDue = assessments.reduce((sum, a) => sum + parseInt(a.amount_due || 0), 0);
    const totalPaid = assessments.reduce((sum, a) => sum + parseInt(a.amount_paid || 0), 0);
    const arrears = Math.max(0, totalDue - totalPaid);

    return {
      summaries: [
        {
          id: parish?.id,
          name: parish?.name,
          enrolled: totalEnrolled,
          totalDue,
          totalPaid,
          currentArrears: arrears,
          previousArrears: 0,
          totalBalance: arrears,
        },
      ],
    };
  }

  // Group in memory
  const deaneryMap = new Map<string, any>();

  assessments.forEach((a: any) => {
    const deanery = a.parish?.deanery;
    const parish = a.parish;
    const deaneryKey = a.deanery_id;  // Use direct column, not nested relationship

    if (!deaneryMap.has(deaneryKey)) {
      deaneryMap.set(deaneryKey, {
        id: deaneryKey,  // Use direct column value
        name: deanery?.name,  // Use nested relationship for name
        parishes: new Map(),
        totalEnrolled: 0,
        totalDue: 0,
        totalPaid: 0,
      });
    }

    const deaneryData = deaneryMap.get(deaneryKey);

    if (!deaneryData.parishes.has(parish.id)) {
      deaneryData.parishes.set(parish.id, {
        id: parish.id,
        name: parish.name,
        enrolled: 0,
        totalDue: 0,
        totalPaid: 0,
      });
    }

    const parishData = deaneryData.parishes.get(parish.id);
    const headcount = a.headcount || 0;
    const due = parseInt(a.amount_due || 0);
    const paid = parseInt(a.amount_paid || 0);

    parishData.enrolled += headcount;
    parishData.totalDue += due;
    parishData.totalPaid += paid;

    deaneryData.totalEnrolled += headcount;
    deaneryData.totalDue += due;
    deaneryData.totalPaid += paid;
  });

  const summaries = Array.from(deaneryMap.values()).map((deaneryData) => {
    const parishSummaries = Array.from(deaneryData.parishes.values()).map((parishData) => {
      const arrears = Math.max(0, parishData.totalDue - parishData.totalPaid);
      return {
        id: parishData.id,
        name: parishData.name,
        enrolled: parishData.enrolled,
        totalDue: parishData.totalDue,
        totalPaid: parishData.totalPaid,
        currentArrears: arrears,
        previousArrears: 0,
        totalBalance: arrears,
      };
    });

    const deaneryArrears = Math.max(0, deaneryData.totalDue - deaneryData.totalPaid);

    return {
      id: deaneryData.id,
      name: deaneryData.name,
      enrolled: deaneryData.totalEnrolled,
      totalDue: deaneryData.totalDue,
      totalPaid: deaneryData.totalPaid,
      currentArrears: deaneryArrears,
      previousArrears: 0,
      totalBalance: deaneryArrears,
      parishes: parishSummaries,
    };
  });

  return { summaries };
}

export async function getGeneralSummary(params: {
  year: number;
  deaneryId?: string | null;
  parishId?: string | null;
}) {
  const { year, deaneryId, parishId } = params;

  // Fetch all three summaries in parallel
  const [events, projects, enrollment] = await Promise.all([
    getEventsSummary({ year, deaneryId, parishId }),
    getProjectsSummary({ year, deaneryId, parishId }),
    getEnrollmentSummary({ year, deaneryId, parishId }),
  ]);

  return {
    year,
    deaneryId: deaneryId || null,
    parishId: parishId || null,
    events,
    projects,
    enrollment,
  };
}
