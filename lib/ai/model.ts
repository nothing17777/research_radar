import { createOpenAI, openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { EmbeddingModel, LanguageModel } from "ai";

export const OLLAMA_MODEL = "qwen2.5:3b-instruct";
export const GEMINI_MODEL = "gemini-2.5-flash";
export const OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";
export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

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

// Dev has no OPENAI_API_KEY configured, so local runs fall back to Ollama's
// nomic-embed-text (768 dims) and get zero-padded up to the schema's
// vector(1536) in embedPaper.ts — zero-padding both sides of a cosine
// similarity leaves the result unchanged. Production always uses OpenAI's
// text-embedding-3-small per AGENTS.md section 20.
export function getEmbeddingModel(): EmbeddingModel {
  if (process.env.NODE_ENV === "development") {
    return ollama.embeddingModel(OLLAMA_EMBEDDING_MODEL);
  }
  return openai.embeddingModel(OPENAI_EMBEDDING_MODEL);
}
