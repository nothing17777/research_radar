import * as cheerio from "cheerio";
import { extractCleanText } from "@/lib/scraping/cleanText";
import type { CandidateLink, ScrapedPaperData } from "@/lib/scraping/types";
import type { SourceParser } from "./types";

// huggingface.co/datasets lists datasets as /datasets/{owner}/{name} links.
function extractCandidates(listingHtml: string, listingUrl: string): CandidateLink[] {
  const $ = cheerio.load(listingHtml);
  const base = new URL(listingUrl);
  const seen = new Set<string>();
  const candidates: CandidateLink[] = [];

  $('a[href^="/datasets/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !/^\/datasets\/[^/]+\/[^/]+$/.test(href)) return;
    const url = new URL(href, base).toString();
    if (seen.has(url)) return;
    seen.add(url);
    candidates.push({ url });
  });

  return candidates;
}

// Dataset cards render their README as markdown-to-HTML inside an
// [class*="hf-sanitized"] container (verified via a live fetch of
// huggingface.co/datasets/HuggingFaceFW/fineweb). There's no reliable
// per-dataset publish date on the page, so the pipeline stamps scrape time
// for this parser strategy, same treatment as github_trending.
function parseDetail(detailHtml: string, detailUrl: string): ScrapedPaperData | null {
  const $ = cheerio.load(detailHtml);

  const title = new URL(detailUrl).pathname.replace(/^\/datasets\//, "");
  if (!title) return null;

  const rawText = extractCleanText($, '[class*="hf-sanitized"]');
  if (!rawText) return null;

  return { title, publishedAt: null, rawText, imageUrl: null, canonicalUrl: detailUrl };
}

export const huggingfaceDatasetsParser: SourceParser = { extractCandidates, parseDetail };
