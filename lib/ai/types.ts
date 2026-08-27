export interface AnalysisRunSummary {
  status: "completed";
  papersChecked: number;
  analyzed: number;
  skipped: number;
  failed: number;
  batches: number;
  durationMs: number;
  failureReasons: Record<string, number>;
  modelUsed: string;
  embeddingsBackfilled: number;
  embeddingsFailed: number;
}
