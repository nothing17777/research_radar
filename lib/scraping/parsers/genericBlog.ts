import * as cheerio from "cheerio";
import { extractCleanText } from "@/lib/scraping/cleanText";
import type { CandidateLink, ScrapedPaperData } from "@/lib/scraping/types";
import type { SourceParser } from "./types";

// Rejects obvious non-paper paths shared across blog platforms (§9 reject list):
// category/topic index pages, tag pages, search, corporate/support pages.
const REJECT_PATH_PATTERNS = [
  /\/news\/[a-z0-9-]+\/?$/i, // OpenAI category pages, e.g. /news/ai-adoption/
  /\/blog\/label\//i, // Google Research topic/label index pages
  /\/blog\/\d{4}$/i, // Google Research year-archive pages
  /\/(search|tag|tags|topics|category|categories|author|about|contact|support)\//i,
];

function isRejectedPath(pathname: string): boolean {
  return REJECT_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

// OpenAI news index: article cards link to /index/{slug}/.
// Google Research blog: article cards carry class "glue-card--blog" and link to /blog/{slug}/.
// Any other host (e.g. a newsletter archive): fall back to any in-page link
// whose path has 2+ segments and isn't on the reject list — a generic
// "post link" heuristic, since unknown platforms don't share a card class.
function extractCandidates(listingHtml: string, listingUrl: string): CandidateLink[] {
  const $ = cheerio.load(listingHtml);
  const base = new URL(listingUrl);
  const seen = new Set<string>();
  const candidates: CandidateLink[] = [];

  let selector = 'a[href]';
  if (base.hostname === "openai.com") selector = 'a[href^="/index/"]';
  else if (base.hostname === "research.google") selector = 'a.glue-card--blog[href^="/blog/"]';

  $(selector).each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = new URL(href, base).toString();
    const target = new URL(url);
    if (target.hostname !== base.hostname) return;
    const pathname = target.pathname;
    if (isRejectedPath(pathname) || seen.has(url)) return;
    if (selector === 'a[href]' && pathname.split("/").filter(Boolean).length < 2) return;
    seen.add(url);
    const title = $(el).text().trim();
    candidates.push({ url, title: title || undefined });
  });

  return candidates;
}

function parseDetail(detailHtml: string, detailUrl: string): ScrapedPaperData | null {
  const $ = cheerio.load(detailHtml);
  const hostname = new URL(detailUrl).hostname;

  const title = $("h1").first().text().trim() || $("title").text().split("|")[0].trim();
  if (!title) return null;

  let publishedAt: string | null = null;
  let rawText = "";
  let imageUrl: string | null = null;

  if (hostname === "openai.com") {
    const datetime = $("time[datetime]").first().attr("datetime");
    publishedAt = datetime ? new Date(datetime).toISOString() : null;
    rawText = extractCleanText($, "article");
    imageUrl = $('meta[property="og:image"]').attr("content") ?? null;
  } else if (hostname === "research.google") {
    const publishDate = $('[data-blog-publish-date]').first().attr("data-blog-publish-date");
    if (publishDate && /^\d{8}$/.test(publishDate)) {
      const iso = `${publishDate.slice(0, 4)}-${publishDate.slice(4, 6)}-${publishDate.slice(6, 8)}`;
      publishedAt = new Date(iso).toISOString();
    }
    rawText = extractCleanText($, "#page-content");
    imageUrl = $('meta[property="og:image"]').attr("content") ?? null;
  } else {
    // Generic fallback for an unrecognized host (e.g. a newsletter archive):
    // <time datetime> is the most common publish-date convention, and
    // <article>/main content selectors cover most blog platforms/CMSes.
    const datetime = $("time[datetime]").first().attr("datetime");
    publishedAt = datetime ? new Date(datetime).toISOString() : null;
    const bodySelector = ["article", "main", "#page-content", ".post-content", ".entry-content"].find(
      (sel) => $(sel).first().text().trim().length > 0
    );
    rawText = bodySelector ? extractCleanText($, bodySelector) : extractCleanText($, "body");
    imageUrl = $('meta[property="og:image"]').attr("content") ?? null;
  }

  return { title, publishedAt, rawText, imageUrl, canonicalUrl: detailUrl };
}

export const genericBlogParser: SourceParser = { extractCandidates, parseDetail };
