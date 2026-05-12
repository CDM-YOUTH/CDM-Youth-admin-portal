import { supabase } from "@/integrations/supabase/client";

export type DashboardCounts = {
  youths: number;
  enrolled: number;
  cusaMembers: number;
  cusaActive: number;
};

export async function getDashboardCounts(year?: number): Promise<DashboardCounts> {
  const y = year ?? new Date().getFullYear();
  const [youthsRes, enrolledRes, cusaRes, cusaActiveRes] = await Promise.all([
    supabase.from("youths").select("id", { count: "exact", head: true }),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("year", y),
    supabase.from("cusa_members").select("id", { count: "exact", head: true }),
    supabase
      .from("cusa_members")
      .select("id", { count: "exact", head: true })
      .not("leadership_role", "is", null),
  ]);
  return {
    youths: youthsRes.count ?? 0,
    enrolled: enrolledRes.count ?? 0,
    cusaMembers: cusaRes.count ?? 0,
    cusaActive: cusaActiveRes.count ?? 0,
  };
}
