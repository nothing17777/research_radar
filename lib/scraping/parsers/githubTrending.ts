import * as cheerio from "cheerio";
import { extractCleanText } from "@/lib/scraping/cleanText";
import type { CandidateLink, ScrapedPaperData } from "@/lib/scraping/types";
import type { SourceParser } from "./types";

// Trending page renders one <article class="Box-row"> per repo, with the
// owner/repo link inside an <h2>.
function extractCandidates(listingHtml: string, listingUrl: string): CandidateLink[] {
  const $ = cheerio.load(listingHtml);
  const base = new URL(listingUrl);
  const candidates: CandidateLink[] = [];

  $("article.Box-row h2 a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !/^\/[^/]+\/[^/]+$/.test(href)) return; // owner/repo only
    candidates.push({ url: new URL(href, base).toString(), title: $(el).text().replace(/\s+/g, " ").trim() });
  });

  return candidates;
}

// GitHub Trending has no reliable per-repo publish date; published_at is set
// to scrape time by the pipeline for this source (per AGENTS.md decision).
function parseDetail(detailHtml: string, detailUrl: string): ScrapedPaperData | null {
  const $ = cheerio.load(detailHtml);

  const title = $('strong[itemprop="name"]').text().trim() || new URL(detailUrl).pathname.slice(1);
  if (!title) return null;

  const rawText = extractCleanText($, "article.markdown-body");
  const imageUrl = $('meta[property="og:image"]').attr("content") ?? null;

  return { title, publishedAt: null, rawText, imageUrl, canonicalUrl: detailUrl };
}

export const githubTrendingParser: SourceParser = { extractCandidates, parseDetail };
