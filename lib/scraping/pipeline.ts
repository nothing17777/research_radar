import { getActiveSources } from "@/lib/supabase/queries/sources";
import { getExistingOriginalUrls, insertPaper } from "@/lib/supabase/queries/papers";
import { insertLog } from "@/lib/supabase/queries/logs";
import { scrapeUrl } from "@/lib/scraping/oxylabs";
import { getParserForStrategy } from "@/lib/scraping/parsers";
import { validatePaper } from "@/lib/scraping/validatePaper";
import type { ScrapeRunSummary, SourceRunResult } from "@/lib/scraping/types";
import type { SourceRow } from "@/lib/supabase/types";

const DEFAULT_PER_SOURCE_LIMIT = 5;

interface RunOptions {
  sourceIds?: string[];
  perSourceLimit?: number;
}

function bumpReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

export async function processListingHtml(
  source: SourceRow,
  listingHtml: string,
  perSourceLimit: number,
  logPrefix = "[scrape]"
): Promise<SourceRunResult> {
  const result: SourceRunResult = {
    sourceId: source.id,
    sourceName: source.name,
    candidatesFound: 0,
    candidatesRejected: 0,
    duplicatesSkipped: 0,
    detailPagesScraped: 0,
    papersInserted: 0,
    papersRejected: 0,
    rejectionReasons: {},
  };

  const parser = getParserForStrategy(source.parser_strategy);
  if (!parser) {
    result.error = `Unknown parser_strategy "${source.parser_strategy}"`;
    console.error(`${logPrefix} ${result.error} for source ${source.name}`);
    return result;
  }

  const rawCandidates = parser.extractCandidates(listingHtml, source.listing_url);
  result.candidatesFound = rawCandidates.length;
  console.log(`[scrape] ${rawCandidates.length} candidates found: ${source.name}`);

  const dedupedUrls = Array.from(new Set(rawCandidates.map((c) => c.url)));
  const existingUrls = await getExistingOriginalUrls(dedupedUrls);
  const newUrls = dedupedUrls.filter((url) => !existingUrls.has(url));
  result.duplicatesSkipped = dedupedUrls.length - newUrls.length;
  console.log(`${logPrefix} ${result.duplicatesSkipped} duplicates skipped: ${source.name}`);

  for (const url of newUrls) {
    if (result.papersInserted >= perSourceLimit) break;

    let detailHtml: string;
    try {
      const detail = await scrapeUrl(url, { render: "html" });
      detailHtml = detail.content;
      result.detailPagesScraped += 1;
    } catch (err) {
      console.error(`${logPrefix} detail fetch failed for ${url}: ${err instanceof Error ? err.message : err}`);
      result.candidatesRejected += 1;
      bumpReason(result.rejectionReasons, "detail_fetch_failed");
      continue;
    }

    const parsed = parser.parseDetail(detailHtml, url);
    if (!parsed) {
      result.candidatesRejected += 1;
      bumpReason(result.rejectionReasons, "unparseable_detail_page");
      continue;
    }

    if (source.parser_strategy === "github_trending") {
      parsed.publishedAt = new Date().toISOString();
    }

    const rejection = validatePaper(parsed);
    if (rejection) {
      result.papersRejected += 1;
      bumpReason(result.rejectionReasons, rejection);
      continue;
    }

    await insertPaper({
      source_id: source.id,
      original_url: url,
      canonical_url: parsed.canonicalUrl,
      title: parsed.title,
      image_url: parsed.imageUrl,
      published_at: parsed.publishedAt!,
      raw_text: parsed.rawText,
    });
    result.papersInserted += 1;
  }

  console.log(
    `${logPrefix} source completed: ${source.name} — inserted ${result.papersInserted}, rejected ${result.papersRejected}`
  );

  return result;
}

async function runSource(source: SourceRow, perSourceLimit: number): Promise<SourceRunResult> {
  console.log(`[scrape] source start: ${source.name}`);

  let listingHtml: string;
  try {
    const listing = await scrapeUrl(source.listing_url, { render: "html" });
    listingHtml = listing.content;
    console.log(`[scrape] listing fetched: ${source.name}`);
  } catch (err) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      candidatesFound: 0,
      candidatesRejected: 0,
      duplicatesSkipped: 0,
      detailPagesScraped: 0,
      papersInserted: 0,
      papersRejected: 0,
      rejectionReasons: {},
      error: err instanceof Error ? err.message : "Failed to fetch listing page",
    };
  }

  return processListingHtml(source, listingHtml, perSourceLimit, "[scrape]");
}

export async function runScrapePipeline(options: RunOptions): Promise<ScrapeRunSummary> {
  const startedAt = Date.now();
  const perSourceLimit = options.perSourceLimit ?? DEFAULT_PER_SOURCE_LIMIT;

  console.log("[scrape] run started");
  await insertLog("info", "Scrape run started", { perSourceLimit, sourceIds: options.sourceIds });

  const activeSources = await getActiveSources();
  const sources = options.sourceIds
    ? activeSources.filter((s) => options.sourceIds!.includes(s.id))
    : activeSources;

  console.log(`[scrape] selected ${sources.length} sources: ${sources.map((s) => s.name).join(", ")}`);

  const results: SourceRunResult[] = [];
  for (const source of sources) {
    try {
      results.push(await runSource(source, perSourceLimit));
    } catch (err) {
      console.error(`[scrape] unexpected error for source ${source.name}: ${err instanceof Error ? err.message : err}`);
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        candidatesFound: 0,
        candidatesRejected: 0,
        duplicatesSkipped: 0,
        detailPagesScraped: 0,
        papersInserted: 0,
        papersRejected: 0,
        rejectionReasons: {},
        error: err instanceof Error ? err.message : "Unexpected source error",
      });
    }
  }

  const summary: ScrapeRunSummary = {
    status: "completed",
    sourcesChecked: results.length,
    candidatesFound: results.reduce((sum, r) => sum + r.candidatesFound, 0),
    candidatesRejected: results.reduce((sum, r) => sum + r.candidatesRejected, 0),
    duplicatesSkipped: results.reduce((sum, r) => sum + r.duplicatesSkipped, 0),
    detailPagesScraped: results.reduce((sum, r) => sum + r.detailPagesScraped, 0),
    papersInserted: results.reduce((sum, r) => sum + r.papersInserted, 0),
    papersRejected: results.reduce((sum, r) => sum + r.papersRejected, 0),
    papersFailed: results.filter((r) => r.error).length,
    totalDurationMs: Date.now() - startedAt,
    rejectionReasons: results.reduce<Record<string, number>>((acc, r) => {
      for (const [reason, count] of Object.entries(r.rejectionReasons)) {
        acc[reason] = (acc[reason] ?? 0) + count;
      }
      return acc;
    }, {}),
    sources: results,
  };

  console.log("[scrape] run completed", JSON.stringify(summary));
  await insertLog("info", "Scrape run completed", summary as unknown as Record<string, unknown>);

  return summary;
}
