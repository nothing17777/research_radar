import type { CandidateLink, ScrapedPaperData } from "@/lib/scraping/types";

export interface SourceParser {
  extractCandidates(listingHtml: string, listingUrl: string): CandidateLink[];
  parseDetail(detailHtml: string, detailUrl: string): ScrapedPaperData | null;
}
