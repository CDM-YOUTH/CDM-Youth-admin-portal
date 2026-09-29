import { supabase } from "@/integrations/supabase/client";

export interface OrganizationSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description?: string;
  category: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UniformSettings {
  lowStockThreshold: number;
  mediumStockThreshold: number;
  itemsPageSize: number;
  entriesPageSize: number;
  ordersPageSize: number;
}

const DEFAULT_UNIFORM_SETTINGS: UniformSettings = {
  lowStockThreshold: 50,
  mediumStockThreshold: 200,
  itemsPageSize: 10,
  entriesPageSize: 10,
  ordersPageSize: 10,
};

export async function fetchOrganizationSettings(category?: string) {
  const query = supabase.from("organization_settings").select("*");

  if (category) {
    query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching organization settings:", error);
    return [];
  }

  return (data || []) as OrganizationSetting[];
}

export async function fetchUniformSettings(): Promise<UniformSettings> {
  const settings = await fetchOrganizationSettings("uniforms");

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  return {
    lowStockThreshold: (settingsMap.get("uniform_low_stock_threshold") as any)?.value ?? DEFAULT_UNIFORM_SETTINGS.lowStockThreshold,
    mediumStockThreshold: (settingsMap.get("uniform_medium_stock_threshold") as any)?.value ?? DEFAULT_UNIFORM_SETTINGS.mediumStockThreshold,
    itemsPageSize: (settingsMap.get("uniform_items_page_size") as any)?.value ?? DEFAULT_UNIFORM_SETTINGS.itemsPageSize,
    entriesPageSize: (settingsMap.get("uniform_entries_page_size") as any)?.value ?? DEFAULT_UNIFORM_SETTINGS.entriesPageSize,
    ordersPageSize: (settingsMap.get("uniform_orders_page_size") as any)?.value ?? DEFAULT_UNIFORM_SETTINGS.ordersPageSize,
  };
}

export async function updateOrganizationSetting(key: string, value: Record<string, unknown>) {
  const { data, error } = await supabase.rpc("update_setting", {
    setting_key: key,
    new_value: value,
  });

  if (error) {
    throw new Error(`Failed to update setting ${key}: ${error.message}`);
  }

  return data;
}
