import { NextRequest, NextResponse } from "next/server";
import { processScheduledRuns } from "@/lib/scraping/schedulerPipeline";
import { runAnalysisPipeline } from "@/lib/ai/pipeline";
import { insertLog } from "@/lib/supabase/queries/logs";

// Internal-only route: triggered by Vercel Cron (always GET), never callable
// by browsers or users. Protected by CRON_SECRET (injected by Vercel), except
// in local dev where the check is skipped per AGENTS.md section 18.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const cronSecret = request.headers.get("authorization");
    if (!cronSecret || cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let processSummary;
  try {
    processSummary = await processScheduledRuns();
  } catch (err) {
    console.error(`[cron] scheduled results processing failed: ${err instanceof Error ? err.message : err}`);
    await insertLog("error", "Cron pipeline: scheduled results processing failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const analysisSummary = await runAnalysisPipeline({});

  return NextResponse.json({ processSummary, analysisSummary });
}
