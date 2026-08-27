import * as cheerio from "cheerio";
import { extractCleanText } from "@/lib/scraping/cleanText";
import type { CandidateLink, ScrapedPaperData } from "@/lib/scraping/types";
import type { SourceParser } from "./types";

// arXiv listing pages (e.g. /list/cs.AI/recent) render entries as <dt>/<dd> pairs
// inside <dl id="articles">. Each <dt> holds the /abs/{id} link.
function extractCandidates(listingHtml: string): CandidateLink[] {
  const $ = cheerio.load(listingHtml);
  const candidates: CandidateLink[] = [];

  $("dl dt").each((_, dt) => {
    const href = $(dt).find('a[href^="/abs/"]').attr("href");
    if (!href) return;
    const title = $(dt).next("dd").find(".list-title").text().replace(/^Title:\s*/, "").trim();
    candidates.push({ url: new URL(href, "https://arxiv.org").toString(), title: title || undefined });
  });

  return candidates;
}

function parseDetail(detailHtml: string, detailUrl: string): ScrapedPaperData | null {
  const $ = cheerio.load(detailHtml);

  const title = $(".title.mathjax").text().replace(/^Title:\s*/, "").trim();
  if (!title) return null;

  const submitted = $(".dateline").text().match(/\[Submitted on ([^\]]+)\]/);
  const publishedAt = submitted ? new Date(submitted[1]).toISOString() : null;

  const rawText = extractCleanText($, ".abstract.mathjax");

  return {
    title,
    publishedAt,
    rawText,
    imageUrl: null,
    canonicalUrl: detailUrl,
  };
}

export const arxivParser: SourceParser = { extractCandidates, parseDetail };
