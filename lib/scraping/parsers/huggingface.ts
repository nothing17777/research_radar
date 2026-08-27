import * as cheerio from "cheerio";
import { extractCleanText } from "@/lib/scraping/cleanText";
import type { CandidateLink, ScrapedPaperData } from "@/lib/scraping/types";
import type { SourceParser } from "./types";

// huggingface.co/papers lists daily papers as /papers/{arxivId} links.
function extractCandidates(listingHtml: string, listingUrl: string): CandidateLink[] {
  const $ = cheerio.load(listingHtml);
  const base = new URL(listingUrl);
  const seen = new Set<string>();
  const candidates: CandidateLink[] = [];

  $('a[href^="/papers/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !/^\/papers\/[\d.]+$/.test(href)) return;
    const url = new URL(href, base).toString();
    if (seen.has(url)) return;
    seen.add(url);
    candidates.push({ url });
  });

  return candidates;
}

function parseDetail(detailHtml: string, detailUrl: string): ScrapedPaperData | null {
  const $ = cheerio.load(detailHtml);

  const title = $("h1").first().text().trim();
  if (!title) return null;

  const publishedMatch = detailHtml.match(/publishedAt&quot;:&quot;([^&]+)&quot;/);
  const publishedAt = publishedMatch ? new Date(publishedMatch[1]).toISOString() : null;

  const rawText = extractCleanText($, "main");

  return { title, publishedAt, rawText, imageUrl: null, canonicalUrl: detailUrl };
}

export const huggingfaceParser: SourceParser = { extractCandidates, parseDetail };
