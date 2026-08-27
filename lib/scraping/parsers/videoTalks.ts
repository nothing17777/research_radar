import * as cheerio from "cheerio";
import { extractCleanText } from "@/lib/scraping/cleanText";
import type { CandidateLink, ScrapedPaperData } from "@/lib/scraping/types";
import type { SourceParser } from "./types";

// SCAFFOLD, UNVERIFIED: raw YouTube pages don't reliably expose caption/
// transcript text in scraped HTML (it loads via a separate API), so this
// parser only works against a source that publishes real transcript pages
// (e.g. a conference site with full-text talk transcripts) — not YouTube
// directly. Generic heuristics only; re-verify selectors against the actual
// source once a real listing URL is provided (AGENTS.md section 9 — no
// invented URLs, and no invented selectors for an unverified source either).
function extractCandidates(listingHtml: string, listingUrl: string): CandidateLink[] {
  const $ = cheerio.load(listingHtml);
  const base = new URL(listingUrl);
  const seen = new Set<string>();
  const candidates: CandidateLink[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = new URL(href, base).toString();
    const target = new URL(url);
    if (target.hostname !== base.hostname) return;
    if (target.pathname.split("/").filter(Boolean).length < 2) return;
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

  const datetime = $("time[datetime]").first().attr("datetime");
  const publishedAt = datetime ? new Date(datetime).toISOString() : null;

  const bodySelector = ["article", "main", ".transcript", ".post-content"].find(
    (sel) => $(sel).first().text().trim().length > 0
  );
  const rawText = bodySelector ? extractCleanText($, bodySelector) : "";
  if (!rawText) return null;

  const imageUrl = $('meta[property="og:image"]').attr("content") ?? null;

  return { title, publishedAt, rawText, imageUrl, canonicalUrl: detailUrl };
}

export const videoTalksParser: SourceParser = { extractCandidates, parseDetail };
