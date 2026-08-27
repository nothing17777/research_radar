import { embed } from "ai";
import { getEmbeddingModel } from "@/lib/ai/model";
import type { PaperAnalysisInsert, PaperRow } from "@/lib/supabase/types";

const EMBEDDING_DIMENSIONS = 1536;

export async function embedPaper(
  paper: Pick<PaperRow, "title">,
  analysis: Pick<PaperAnalysisInsert, "neutral_summary">
): Promise<number[]> {
  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value: `${paper.title}\n\n${analysis.neutral_summary}`,
  });

  if (embedding.length === EMBEDDING_DIMENSIONS) return embedding;
  if (embedding.length > EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding has ${embedding.length} dims, expected at most ${EMBEDDING_DIMENSIONS}`);
  }

  // Dev-only path (Ollama's nomic-embed-text is 768 dims). Zero-padding both
  // sides of a cosine similarity comparison leaves the result unchanged.
  return [...embedding, ...new Array(EMBEDDING_DIMENSIONS - embedding.length).fill(0)];
}
