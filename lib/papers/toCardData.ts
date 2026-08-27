import type { PaperDisplayItem } from "@/lib/supabase/queries/papers";
import type { PaperCardData } from "@/components/research-radar/paper-card";
import { formatReadTime, formatRelativeTime, truncate } from "@/lib/papers/display";

const EXCERPT_MAX_LENGTH = 160;

export function toCardData(item: PaperDisplayItem): PaperCardData {
  return {
    id: item.paper.id,
    title: item.paper.title,
    excerpt: truncate(item.analysis.neutral_summary, EXCERPT_MAX_LENGTH),
    imageUrl: item.paper.image_url ?? "/paper-placeholder.svg",
    categories: [item.analysis.primary_category],
    difficulty: item.analysis.difficulty_label,
    confidence: item.analysis.confidence,
    publishedLabel: formatRelativeTime(item.paper.published_at),
    readTimeLabel: formatReadTime(item.paper.raw_text),
    kind: item.kind,
  };
}
