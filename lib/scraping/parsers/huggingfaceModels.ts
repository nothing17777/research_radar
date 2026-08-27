import * as cheerio from "cheerio";
import { extractCleanText } from "@/lib/scraping/cleanText";
import type { CandidateLink, ScrapedPaperData } from "@/lib/scraping/types";
import type { SourceParser } from "./types";

// huggingface.co/models lists models as root-level /{owner}/{name} links
// (no /models/ prefix, unlike datasets/papers). Reserved top-level paths are
// excluded so site navigation isn't picked up as a model candidate.
const RESERVED_TOP_SEGMENTS = new Set([
  "models",
  "datasets",
  "spaces",
  "papers",
  "docs",
  "blog",
  "join",
  "login",
  "pricing",
  "inference",
  "tasks",
  "chat",
  "learn",
  "enterprise",
  "settings",
  "organizations",
  "collections",
  "posts",
  "new",
  "playground",
]);

function extractCandidates(listingHtml: string, listingUrl: string): CandidateLink[] {
  const $ = cheerio.load(listingHtml);
  const base = new URL(listingUrl);
  const seen = new Set<string>();
  const candidates: CandidateLink[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !/^\/[^/]+\/[^/]+$/.test(href)) return;
    const [, owner] = href.split("/");
    if (RESERVED_TOP_SEGMENTS.has(owner.toLowerCase())) return;
    const url = new URL(href, base).toString();
    if (seen.has(url)) return;
    seen.add(url);
    candidates.push({ url });
  });

  return candidates;
}

// Model cards render their README in the same [class*="hf-sanitized"]
// container as datasets (verified via a live fetch of
// huggingface.co/google/gemma-2-9b). No reliable per-model publish date, so
// the pipeline stamps scrape time for this parser strategy.
function parseDetail(detailHtml: string, detailUrl: string): ScrapedPaperData | null {
  const $ = cheerio.load(detailHtml);

  const title = new URL(detailUrl).pathname.slice(1);
  if (!title) return null;

  const rawText = extractCleanText($, '[class*="hf-sanitized"]');
  if (!rawText) return null;

  return { title, publishedAt: null, rawText, imageUrl: null, canonicalUrl: detailUrl };
}

export const huggingfaceModelsParser: SourceParser = { extractCandidates, parseDetail };
