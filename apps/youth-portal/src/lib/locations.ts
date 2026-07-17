import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDeaneries() {
  return useQuery({
    queryKey: ["deaneries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deaneries").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useParishes(deaneryId?: string) {
  return useQuery({
    queryKey: ["parishes", deaneryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parishes")
        .select("id,name,deanery_id")
        .eq("deanery_id", deaneryId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!deaneryId,
  });
}

export function useOutstations(parishId?: string) {
  return useQuery({
    queryKey: ["outstations", parishId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outstations")
        .select("id,name,parish_id")
        .eq("parish_id", parishId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!parishId,
  });
}
