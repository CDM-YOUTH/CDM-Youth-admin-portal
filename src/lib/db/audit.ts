import { supabase } from "@/integrations/supabase/client";

export type EnrollmentAuditRow = {
  id: string;
  enrollment_id: string | null;
  youth_id: string | null;
  action: "create" | "update" | "delete" | "status_change" | "bulk_create";
  actor: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

export async function logEnrollmentAudit(entry: {
  enrollmentId?: string | null;
  youthId?: string | null;
  action: EnrollmentAuditRow["action"];
  actor?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const { error } = await supabase.from("enrollment_audit_log").insert({
    enrollment_id: entry.enrollmentId ?? null,
    youth_id: entry.youthId ?? null,
    action: entry.action,
    actor: entry.actor ?? null,
    before: (entry.before ?? null) as never,
    after: (entry.after ?? null) as never,
  });
  if (error) console.warn("[audit] failed to log:", error.message);
}

export async function listEnrollmentAudit(limit = 100): Promise<EnrollmentAuditRow[]> {
  const { data, error } = await supabase
    .from("enrollment_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as EnrollmentAuditRow[];
}