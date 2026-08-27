import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { PaperAnalysisInsert, PaperAnalysisRow } from "@/lib/supabase/types";

export async function insertPaperAnalysis(analysis: PaperAnalysisInsert): Promise<PaperAnalysisRow> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("paper_analyses").insert(analysis).select().single();

  if (error) throw error;
  return data;
}

// Backfill target: paper_analyses rows saved before pgvector embeddings existed.
export async function getAnalysesMissingEmbedding(): Promise<PaperAnalysisRow[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("paper_analyses").select("*").is("embedding", null);

  if (error) throw error;
  return data;
}

export async function updatePaperAnalysisEmbedding(paperId: string, embedding: number[]): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("paper_analyses").update({ embedding }).eq("paper_id", paperId);

  if (error) throw error;
}
