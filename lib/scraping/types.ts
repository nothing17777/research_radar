export interface CandidateLink {
  url: string;
  title?: string;
}

export interface ScrapedPaperData {
  title: string;
  publishedAt: string | null;
  rawText: string;
  imageUrl: string | null;
  canonicalUrl: string | null;
}

export interface SourceRunResult {
  sourceId: string;
  sourceName: string;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  papersInserted: number;
  papersRejected: number;
  rejectionReasons: Record<string, number>;
  error?: string;
}

export interface ScrapeRunSummary {
  status: "completed" | "failed";
  sourcesChecked: number;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  papersInserted: number;
  papersRejected: number;
  papersFailed: number;
  totalDurationMs: number;
  rejectionReasons: Record<string, number>;
  sources: SourceRunResult[];
}
