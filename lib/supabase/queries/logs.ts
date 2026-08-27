import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { LogLevel, LogRow } from "@/lib/supabase/types";

export async function insertLog(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("logs")
    .insert({ level, message, context: context ?? null });

  if (error) throw error;
}

export async function getRecentLogs(limit = 100): Promise<LogRow[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
