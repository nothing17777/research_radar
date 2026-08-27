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
function extractCandidates(listingHtml: string, listingUrl: string): CandidateLink[] {
  const $ = cheerio.load(listingHtml);
  const base = new URL(listingUrl);
  const seen = new Set<string>();
  const candidates: CandidateLink[] = [];

  const selectors =
    base.hostname === "openai.com" ? ['a[href^="/index/"]'] : ['a.glue-card--blog[href^="/blog/"]'];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const url = new URL(href, base).toString();
      const pathname = new URL(url).pathname;
      if (isRejectedPath(pathname) || seen.has(url)) return;
      seen.add(url);
      const title = $(el).text().trim();
      candidates.push({ url, title: title || undefined });
    });
  }

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
  } else {
    const publishDate = $('[data-blog-publish-date]').first().attr("data-blog-publish-date");
    if (publishDate && /^\d{8}$/.test(publishDate)) {
      const iso = `${publishDate.slice(0, 4)}-${publishDate.slice(4, 6)}-${publishDate.slice(6, 8)}`;
      publishedAt = new Date(iso).toISOString();
    }
    rawText = extractCleanText($, "#page-content");
    imageUrl = $('meta[property="og:image"]').attr("content") ?? null;
  }

  return { title, publishedAt, rawText, imageUrl, canonicalUrl: detailUrl };
}

export const genericBlogParser: SourceParser = { extractCandidates, parseDetail };
