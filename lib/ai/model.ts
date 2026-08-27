import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { EmbeddingModel, LanguageModel } from "ai";

export const OLLAMA_MODEL = "qwen2.5:3b-instruct";
export const GEMINI_MODEL = "gemini-2.5-flash";
export const OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";

const ollama = createOpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama",
});

export function getAnalysisModel(): LanguageModel {
  if (process.env.NODE_ENV === "development") {
    return ollama.chat(OLLAMA_MODEL);
  }
  return google(GEMINI_MODEL);
}

export function getAnalysisModelName(): string {
  return process.env.NODE_ENV === "development" ? OLLAMA_MODEL : GEMINI_MODEL;
}

// Dev uses Ollama's free nomic-embed-text (768 dims), zero-padded up to the
// schema's vector(1536) in embedPaper.ts — zero-padding both sides of a
// cosine similarity leaves the result unchanged. Production uses Google's
// free gemini-embedding-001, requested at 1536 dims via outputDimensionality
// so both environments write directly comparable vectors into the same
// vector(1536) column without a schema change.
export function getEmbeddingModel(): EmbeddingModel {
  if (process.env.NODE_ENV === "development") {
    return ollama.embeddingModel(OLLAMA_EMBEDDING_MODEL);
  }
  return google.embeddingModel(GEMINI_EMBEDDING_MODEL);
}

export function getEmbeddingProviderOptions() {
  if (process.env.NODE_ENV === "development") return undefined;
  return { google: { outputDimensionality: 1536 } };
}
