import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { SourceRow } from "@/lib/supabase/types";

export async function getActiveSources(): Promise<SourceRow[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data;
}

export async function getSourceById(id: string): Promise<SourceRow | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}
