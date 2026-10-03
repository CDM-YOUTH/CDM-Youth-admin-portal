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
