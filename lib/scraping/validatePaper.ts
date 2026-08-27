import type { ScrapedPaperData } from "@/lib/scraping/types";

const MIN_MEANINGFUL_PARAGRAPHS = 3;
const MIN_MEANINGFUL_CHARS = 900;

const GENERIC_TITLE_PATTERNS = [/^(news|blog|home|category|tag|topics?)$/i];

export type RejectionReason =
  | "missing_title"
  | "generic_title"
  | "missing_published_date"
  | "insufficient_body";

export function validatePaper(data: ScrapedPaperData): RejectionReason | null {
  if (!data.title.trim()) return "missing_title";
  if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(data.title.trim()))) {
    return "generic_title";
  }
  if (!data.publishedAt) return "missing_published_date";

  const meaningfulParagraphs = data.rawText
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 40);

  const passesParagraphs = meaningfulParagraphs.length >= MIN_MEANINGFUL_PARAGRAPHS;
  const passesLength = data.rawText.length >= MIN_MEANINGFUL_CHARS;

  if (!passesParagraphs && !passesLength) return "insufficient_body";

  return null;
}
