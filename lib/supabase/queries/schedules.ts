import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type {
  OxylabsScheduleInsert,
  OxylabsScheduleRow,
  OxylabsScheduleRunInsert,
  OxylabsScheduleRunRow,
} from "@/lib/supabase/types";

export async function getAllSchedules(): Promise<OxylabsScheduleRow[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("oxylabs_schedules").select("*");

  if (error) throw error;
  return data;
}

export async function markScheduleRunProcessed(id: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("oxylabs_schedule_runs")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function getScheduleBySourceId(
  sourceId: string
): Promise<OxylabsScheduleRow | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("oxylabs_schedules")
    .select("*")
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertSchedule(
  schedule: OxylabsScheduleInsert
): Promise<OxylabsScheduleRow> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("oxylabs_schedules")
    .upsert(schedule, { onConflict: "source_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function insertScheduleRun(
  run: OxylabsScheduleRunInsert
): Promise<OxylabsScheduleRunRow> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("oxylabs_schedule_runs")
    .insert(run)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getDoneRunsForSchedule(
  scheduleId: string
): Promise<OxylabsScheduleRunRow[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("oxylabs_schedule_runs")
    .select("*")
    .eq("schedule_id", scheduleId)
    .eq("result_status", "done")
    .is("processed_at", null);

  if (error) throw error;
  return data;
}
