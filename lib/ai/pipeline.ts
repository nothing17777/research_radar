import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getPendingAnalysisPapers, markPaperAnalyzed } from "@/lib/supabase/queries/papers";
import {
  insertPaperAnalysis,
  getAnalysesMissingEmbedding,
  updatePaperAnalysisEmbedding,
} from "@/lib/supabase/queries/paperAnalyses";
import { insertLog } from "@/lib/supabase/queries/logs";
import { analyzePaper } from "@/lib/ai/analyzePaper";
import { embedPaper } from "@/lib/ai/embedPaper";
import { getAnalysisModelName } from "@/lib/ai/model";
import type { AnalysisRunSummary } from "@/lib/ai/types";
import type { PaperRow } from "@/lib/supabase/types";

const DEFAULT_BATCH_SIZE = Number(process.env.ANALYSIS_BATCH_SIZE) || 5;

interface RunOptions {
  limit?: number;
  paperIds?: string[];
}

function bumpReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function runAnalysisPipeline(options: RunOptions): Promise<AnalysisRunSummary> {
  const startedAt = Date.now();
  const modelUsed = getAnalysisModelName();

  console.log("[analyze] run started");
  await insertLog("info", "Analysis run started", options as Record<string, unknown>);

  let pending: PaperRow[];
  if (options.paperIds) {
    const allPending = await getPendingAnalysisPapers();
    const pendingIds = new Set(allPending.map((p) => p.id));
    pending = options.paperIds
      .filter((id) => pendingIds.has(id))
      .map((id) => allPending.find((p) => p.id === id)!)
      .filter(Boolean);
  } else {
    pending = await getPendingAnalysisPapers(options.limit);
  }

  console.log(`[analyze] ${pending.length} papers pending analysis`);

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;
  const failureReasons: Record<string, number> = {};
  const batches = chunk(pending, DEFAULT_BATCH_SIZE);

  for (const [batchIndex, batch] of batches.entries()) {
    console.log(`[analyze] batch ${batchIndex + 1}/${batches.length} — ${batch.length} papers`);

    for (const paper of batch) {
      try {
        const analysis = await analyzePaper(paper);
        await insertPaperAnalysis(analysis);
        await markPaperAnalyzed(paper.id);
        analyzed += 1;
        console.log(`[analyze] analyzed: ${paper.title}`);
      } catch (err) {
        failed += 1;
        const reason = err instanceof Error ? err.message : "Unknown analysis error";
        bumpReason(failureReasons, reason);
        console.error(`[analyze] failed: ${paper.title} — ${reason}`);
      }
    }
  }

  if (options.paperIds) {
    skipped = options.paperIds.length - pending.length;
  }

  let embeddingsBackfilled = 0;
  let embeddingsFailed = 0;

  // Backfill embeddings for paper_analyses rows saved before pgvector was added
  // (AGENTS.md section 20) — these already have an analysis, just no embedding.
  const missingEmbedding = await getAnalysesMissingEmbedding();
  if (missingEmbedding.length > 0) {
    console.log(`[analyze] ${missingEmbedding.length} analyses missing embedding`);
    const supabase = createServiceRoleSupabaseClient();
    const { data: papers, error } = await supabase
      .from("papers")
      .select("*")
      .in(
        "id",
        missingEmbedding.map((a) => a.paper_id)
      );
    if (error) throw error;
    const paperById = new Map(papers.map((p) => [p.id, p]));

    for (const analysis of missingEmbedding) {
      const paper = paperById.get(analysis.paper_id);
      if (!paper) continue;
      try {
        const embedding = await embedPaper(paper, analysis);
        await updatePaperAnalysisEmbedding(analysis.paper_id, embedding);
        embeddingsBackfilled += 1;
        console.log(`[analyze] embedding backfilled: ${paper.title}`);
      } catch (err) {
        embeddingsFailed += 1;
        const reason = err instanceof Error ? err.message : "Unknown embedding error";
        console.error(`[analyze] embedding backfill failed: ${paper.title} — ${reason}`);
      }
    }
  }

  const summary: AnalysisRunSummary = {
    status: "completed",
    papersChecked: pending.length,
    analyzed,
    skipped,
    failed,
    batches: batches.length,
    durationMs: Date.now() - startedAt,
    failureReasons,
    modelUsed,
    embeddingsBackfilled,
    embeddingsFailed,
  };

  console.log("[analyze] run completed", JSON.stringify(summary));
  await insertLog("info", "Analysis run completed", summary as unknown as Record<string, unknown>);

  return summary;
}
