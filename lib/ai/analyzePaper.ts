import { generateText, Output } from "ai";
import { z } from "zod";
import { getAnalysisModel, getAnalysisModelName } from "@/lib/ai/model";
import { embedPaper } from "@/lib/ai/embedPaper";
import type { PaperAnalysisInsert, PaperRow } from "@/lib/supabase/types";

const DISCLAIMER =
  "This technical difficulty assessment and summary are AI-estimated based on the paper's text only, not objective fact. Verify against the original source before relying on it.";

const analysisSchema = z.object({
  neutralSummary: z
    .string()
    .describe("Concise, neutral technical summary of what the paper/article does or claims, based only on its text."),
  technicalDifficultyScore: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe(
      "Estimated technical difficulty from 1 to 10. Scores 1-4 are beginner, 5-7 are intermediate, 8-10 are expert."
    ),
  difficultyLabel: z
    .enum(["beginner", "intermediate", "expert"])
    .describe(
      "Must match technicalDifficultyScore exactly: 1-4 => beginner, 5-7 => intermediate, 8-10 => expert."
    ),
  coreMethodology: z
    .string()
    .describe("Plain-text or bullet breakdown of the technical approach/methodology used."),
  keyTakeaways: z
    .array(z.string())
    .length(3)
    .describe("Exactly 3 developer-focused, evidence-based action points."),
  primaryCategory: z
    .string()
    .describe("Best matching domain tag for the paper, e.g. LLMs, NLP, Systems, Computer Vision."),
  prerequisites: z
    .array(z.string())
    .nullable()
    .describe("Concepts a reader should know before this paper, or null if none are needed."),
  confidence: z.number().min(0).max(1),
});

type AnalysisOutput = z.infer<typeof analysisSchema>;

function difficultyBandMatches(score: number, label: AnalysisOutput["difficultyLabel"]): boolean {
  if (score <= 4) return label === "beginner";
  if (score <= 7) return label === "intermediate";
  return label === "expert";
}

async function generateAnalysis(paper: PaperRow): Promise<AnalysisOutput> {
  const { output: object } = await generateText({
    model: getAnalysisModel(),
    output: Output.object({ schema: analysisSchema }),
    prompt: `You are evaluating a technical research paper or blog post for an academic/technical audience. Use only evidence from the text below — do not infer quality or difficulty based on the source's brand or reputation.

When scoring technicalDifficultyScore and difficultyLabel, they must agree using this exact mapping:
- score 1, 2, 3, or 4 => difficultyLabel "beginner"
- score 5, 6, or 7 => difficultyLabel "intermediate"
- score 8, 9, or 10 => difficultyLabel "expert"
Pick the score first, then set difficultyLabel to match its band. Never pick a label from a different band than the score.

Title: ${paper.title}

Text:
${paper.raw_text}`,
  });

  if (!difficultyBandMatches(object.technicalDifficultyScore, object.difficultyLabel)) {
    throw new Error(
      `difficultyLabel "${object.difficultyLabel}" does not match technicalDifficultyScore ${object.technicalDifficultyScore}`
    );
  }

  return object;
}

export async function analyzePaper(paper: PaperRow): Promise<PaperAnalysisInsert> {
  let output: AnalysisOutput;
  try {
    output = await generateAnalysis(paper);
  } catch {
    output = await generateAnalysis(paper);
  }

  const analysis: PaperAnalysisInsert = {
    paper_id: paper.id,
    neutral_summary: output.neutralSummary,
    technical_difficulty_score: output.technicalDifficultyScore,
    difficulty_label: output.difficultyLabel,
    core_methodology: output.coreMethodology,
    key_takeaways: [output.keyTakeaways[0], output.keyTakeaways[1], output.keyTakeaways[2]],
    confidence: output.confidence,
    disclaimer: DISCLAIMER,
    model_name: getAnalysisModelName(),
    primary_category: output.primaryCategory,
    prerequisites: output.prerequisites,
  };

  analysis.embedding = await embedPaper(paper, analysis);

  return analysis;
}
