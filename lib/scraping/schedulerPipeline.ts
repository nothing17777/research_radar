import { getActiveSources, getSourceById } from "@/lib/supabase/queries/sources";
import {
  getAllSchedules,
  getScheduleBySourceId,
  upsertSchedule,
  insertScheduleRun,
  getDoneRunsForSchedule,
  markScheduleRunProcessed,
} from "@/lib/supabase/queries/schedules";
import { insertLog } from "@/lib/supabase/queries/logs";
import {
  createSchedule,
  listOxylabsScheduleIds,
  setScheduleActive,
  getScheduleRuns,
  getJobResultHtml,
} from "@/lib/scraping/oxylabsSchedulerClient";
import { processListingHtml } from "@/lib/scraping/pipeline";
import type { ScrapeRunSummary, SourceRunResult } from "@/lib/scraping/types";
import type { OxylabsScheduleRow } from "@/lib/supabase/types";

const CRON_EXPRESSION = "0 * * * *"; // hourly
const SCHEDULE_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
const DEFAULT_PER_SOURCE_LIMIT = 5;

export interface SyncSchedulesSummary {
  created: number;
  updated: number;
  deactivated: number;
}

export async function syncSchedules(): Promise<SyncSchedulesSummary> {
  console.log("[scheduler] sync started");
  await insertLog("info", "Scheduler sync started");

  const activeSources = await getActiveSources();
  const endTime = new Date(Date.now() + SCHEDULE_LIFETIME_MS).toISOString().replace("T", " ").slice(0, 19);

  let created = 0;
  let updated = 0;
  const liveScheduleIds: string[] = [];

  for (const source of activeSources) {
    const existing = await getScheduleBySourceId(source.id);
    const { scheduleId } = await createSchedule(source.listing_url, CRON_EXPRESSION, endTime);
    liveScheduleIds.push(scheduleId);

    await upsertSchedule({
      source_id: source.id,
      oxylabs_schedule_id: scheduleId,
      cron_expression: CRON_EXPRESSION,
      is_active: true,
    });

    if (existing) updated += 1;
    else created += 1;
    console.log(`[scheduler] schedule synced for source: ${source.name}`);
  }

  // Deactivate any Oxylabs schedule not present in the DB (orphans left behind
  // by deleted/re-created source rows) — AGENTS.md section 18.
  const allOxylabsIds = await listOxylabsScheduleIds();
  const dbSchedules = await getAllSchedules();
  const dbScheduleIds = new Set(dbSchedules.map((s) => s.oxylabs_schedule_id));

  let deactivated = 0;
  for (const oxylabsId of allOxylabsIds) {
    if (!dbScheduleIds.has(oxylabsId)) {
      await setScheduleActive(oxylabsId, false);
      deactivated += 1;
      console.log(`[scheduler] deactivated orphan schedule: ${oxylabsId}`);
    }
  }

  const summary: SyncSchedulesSummary = { created, updated, deactivated };
  console.log("[scheduler] sync completed", JSON.stringify(summary));
  await insertLog("info", "Scheduler sync completed", summary as unknown as Record<string, unknown>);

  return summary;
}

async function processSchedule(schedule: OxylabsScheduleRow, perSourceLimit: number): Promise<SourceRunResult[]> {
  const source = await getSourceById(schedule.source_id);
  if (!source) {
    console.error(`[scheduler] source not found for schedule ${schedule.id}`);
    return [];
  }

  const runs = await getScheduleRuns(schedule.oxylabs_schedule_id);
  const doneRunRows = await getDoneRunsForSchedule(schedule.id);
  const alreadyProcessedRunIds = new Set(doneRunRows.map((r) => r.oxylabs_run_id));

  const results: SourceRunResult[] = [];

  for (const run of runs) {
    const doneJobs = run.jobs.filter((j) => j.resultStatus === "done");
    if (doneJobs.length === 0) continue;

    for (const job of doneJobs) {
      const runRow = await insertScheduleRun({
        schedule_id: schedule.id,
        oxylabs_run_id: run.runId,
        oxylabs_job_id: job.id,
        result_status: job.resultStatus,
      });

      if (alreadyProcessedRunIds.has(run.runId)) {
        await markScheduleRunProcessed(runRow.id);
        continue;
      }

      let html: string;
      try {
        html = await getJobResultHtml(job.id);
      } catch (err) {
        console.error(`[scheduler] job result fetch failed for job ${job.id}: ${err instanceof Error ? err.message : err}`);
        continue;
      }

      const result = await processListingHtml(source, html, perSourceLimit, "[scheduler]");
      results.push(result);
      await markScheduleRunProcessed(runRow.id);
    }
  }

  return results;
}

export async function processScheduledRuns(options: { scheduleIds?: string[] } = {}): Promise<ScrapeRunSummary> {
  const startedAt = Date.now();

  console.log("[scheduler] processing started");
  await insertLog("info", "Scheduler processing started", options as Record<string, unknown>);

  const allSchedules = await getAllSchedules();
  const schedules = options.scheduleIds
    ? allSchedules.filter((s) => options.scheduleIds!.includes(s.id))
    : allSchedules;

  const results: SourceRunResult[] = [];
  for (const schedule of schedules) {
    try {
      results.push(...(await processSchedule(schedule, DEFAULT_PER_SOURCE_LIMIT)));
    } catch (err) {
      console.error(`[scheduler] unexpected error for schedule ${schedule.id}: ${err instanceof Error ? err.message : err}`);
      results.push({
        sourceId: schedule.source_id,
        sourceName: schedule.source_id,
        candidatesFound: 0,
        candidatesRejected: 0,
        duplicatesSkipped: 0,
        detailPagesScraped: 0,
        papersInserted: 0,
        papersRejected: 0,
        rejectionReasons: {},
        error: err instanceof Error ? err.message : "Unexpected schedule error",
      });
    }
  }

  const summary: ScrapeRunSummary = {
    status: "completed",
    sourcesChecked: results.length,
    candidatesFound: results.reduce((sum, r) => sum + r.candidatesFound, 0),
    candidatesRejected: results.reduce((sum, r) => sum + r.candidatesRejected, 0),
    duplicatesSkipped: results.reduce((sum, r) => sum + r.duplicatesSkipped, 0),
    detailPagesScraped: results.reduce((sum, r) => sum + r.detailPagesScraped, 0),
    papersInserted: results.reduce((sum, r) => sum + r.papersInserted, 0),
    papersRejected: results.reduce((sum, r) => sum + r.papersRejected, 0),
    papersFailed: results.filter((r) => r.error).length,
    totalDurationMs: Date.now() - startedAt,
    rejectionReasons: results.reduce<Record<string, number>>((acc, r) => {
      for (const [reason, count] of Object.entries(r.rejectionReasons)) {
        acc[reason] = (acc[reason] ?? 0) + count;
      }
      return acc;
    }, {}),
    sources: results,
  };

  console.log("[scheduler] processing completed", JSON.stringify(summary));
  await insertLog("info", "Scheduler processing completed", summary as unknown as Record<string, unknown>);

  return summary;
}
