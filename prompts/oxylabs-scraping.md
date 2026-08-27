# Oxylabs Manual Scraping Pipeline

## Goal
Implement manual scraping (AGENTS.md §16) end-to-end: `POST /api/scrape` runs the
scrape-to-insert pipeline (§9-13) against a diverse set of 5 seeded sources, using
per-source parser strategies, and inserts validated papers into Supabase.

Out of scope (separate future prompts): Oxylabs Scheduler (§18), Vercel Cron,
AI analysis (§19).

## Skills read
- `.agents/skills/web-scraper-api/SKILL.md` (Oxylabs Web Scraper API — auth, endpoint,
  `universal` source, `render`, response shape)
- `.agents/skills/supabase/SKILL.md` (service-role usage, joined-table filter gotcha,
  RLS — no schema/RLS changes needed here since sources/papers already exist)

## Existing code inspected
- `supabase/schema.sql` — `sources`, `papers` tables already match AGENTS.md §7.
- `lib/supabase/types.ts` — `SourceRow`, `PaperInsert`, `PaperRow` already defined.
- `lib/supabase/server.ts` — `createServiceRoleSupabaseClient()`, server-only.
- `lib/supabase/queries/sources.ts` — `getActiveSources()` already exists.
- `lib/supabase/queries/papers.ts` — `getExistingOriginalUrls()` (15-url chunking,
  §9 URL existence check), `insertPaper()` already exist and match spec.
- `lib/supabase/queries/logs.ts` — `insertLog(level, message, context?)` already exists
  for §9 run logging (in addition to console logs).
- `sources` table is currently **empty** — no rows exist.
- No `app/api/` routes exist yet.
- `cheerio` and `zod` are **not yet installed** — must be added.

## Decisions / assumptions (confirmed with user)
1. **Seed 5 active sources** directly in `supabase/schema.sql` as an idempotent
   `insert ... on conflict (listing_url) do nothing` block, run manually via the
   Supabase SQL editor (per AGENTS.md workflow: update schema.sql, then run the SQL):
   | name | listing_url | parser_strategy |
   |---|---|---|
   | arXiv cs.AI | https://arxiv.org/list/cs.AI/recent | arxiv |
   | OpenAI Blog | https://openai.com/news/ | generic_blog |
   | Google Research Blog | https://research.google/blog/ | generic_blog |
   | GitHub Trending TypeScript | https://github.com/trending/typescript?since=daily | github_trending |
   | Hugging Face Daily Papers | https://huggingface.co/papers | huggingface |
2. **Parser strategy routing**: `lib/scraping/parsers/` holds one module per strategy
   (`arxiv.ts`, `genericBlog.ts`, `githubTrending.ts`, `huggingface.ts`), each exporting
   a function matching a shared interface. A registry (`lib/scraping/parsers/index.ts`)
   maps `source.parser_strategy` string to the parser. Unknown/null strategy is a
   source-level error (logged, source skipped), not a crash.
3. **GitHub Trending has no per-repo listing date** — user confirmed: use scrape time
   (`now()`) as `published_at` for this source only, since trending reflects current
   momentum not creation date. Other sources must extract a real published date from
   the article/paper detail page and reject if missing (§13).
4. Detail-page scraping for all sources goes through Oxylabs (`source: "universal"`,
   `render: "html"` since most of these are JS-heavy pages) via `realtime.oxylabs.io`
   — this task does not need Push-Pull/scheduler.
5. Per-source cap: default 5 valid papers per source (§16), unless the user's request
   overrides it at call time via request body.

## Files likely to change
- `package.json` — add `cheerio`, `zod`.
- `supabase/schema.sql` — add seed insert block for the 5 sources.
- `lib/scraping/oxylabs.ts` — thin Oxylabs client (`scrapeUrl(url, opts)` via
  `realtime.oxylabs.io/v1/queries`, basic auth from `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD`).
- `lib/scraping/parsers/types.ts` — shared `CandidateLink` and parser function interface.
- `lib/scraping/parsers/arxiv.ts`
- `lib/scraping/parsers/genericBlog.ts`
- `lib/scraping/parsers/githubTrending.ts`
- `lib/scraping/parsers/huggingface.ts`
- `lib/scraping/parsers/index.ts` — strategy registry.
- `lib/scraping/extractCandidates.ts` — runs listing HTML through the right parser,
  applies the non-paper reject list (§9) generically where parsers don't already filter.
- `lib/scraping/validatePaper.ts` — §13 content gate (title, published date, body
  quality: 3+ paragraphs or 900+ chars after cleanup) + raw_text cleanup (strip
  scripts/styles/nav/ads/social-share boilerplate).
- `lib/scraping/pipeline.ts` — orchestrates the full scrape-to-insert flow (§9) per
  source: fetch listing → extract candidates → reject → dedupe (existing
  `getExistingOriginalUrls`) → scrape detail pages → validate → insert
  (existing `insertPaper`) → build run summary.
- `lib/scraping/types.ts` — `ScrapeRunSummary`, per-source result types.
- `app/api/scrape/route.ts` — `POST` handler: validates `x-radar-admin-secret`
  (§15), parses optional `{ sourceIds?: string[], perSourceLimit?: number }` body
  with Zod, calls `runScrapePipeline()`, returns the summary JSON.

## Implementation requirements
- **Admin secret**: reject requests missing/mismatching `x-radar-admin-secret` vs
  `process.env.RADAR_ADMIN_SECRET` with 401, before any work starts.
- **Source selection**: default to all active sources; if `sourceIds` given, restrict
  to those (still must be `is_active`); if `perSourceLimit` given, use it, else 5.
- **Pipeline steps** (§9, per source, sequential per source to keep logs readable):
  1. Fetch listing HTML via Oxylabs `universal` source (`render: "html"`).
  2. Route to the parser for `source.parser_strategy`; extract candidate links only
     from visible paper/article/repo cards (§11) — never crawl into sublinks.
  3. Reject candidates matching the non-paper reject list (§9) — parsers apply
     source-specific detail-URL pattern checks per §12 (e.g. arXiv `/abs/…`,
     blog `/blog|/news` slug paths, GitHub `owner/repo` paths, HF `/papers/…`).
  4. Normalize + dedupe candidate URLs in-run, then filter out URLs already in
     Supabase via `getExistingOriginalUrls` (15-url chunks — already implemented).
  5. Detail-scrape remaining candidates via Oxylabs, up to `perSourceLimit` valid
     papers (stop early once limit reached to avoid wasted Oxylabs calls).
  6. Validate + clean each detail page per §13; for GitHub Trending, set
     `published_at` to scrape time instead of extracting a date (per decision #3).
  7. Insert valid papers via `insertPaper` (append-only, no updates/deletes).
  8. Log per-source progress via `console.log` and `insertLog()` (§9 run logging:
     started, sources selected, per-source start, listing fetched, candidates found,
     candidates rejected, duplicates skipped, detail pages scraped, papers inserted,
     papers rejected, source-level errors, completed/failed).
  9. One source failing (e.g. Oxylabs error) must not abort the whole run — catch,
     log, continue to next source.
- **Final summary object** (§9) returned from `POST /api/scrape` and logged: status,
  sources checked, candidates found, candidates rejected, duplicates skipped, detail
  pages scraped, papers inserted, papers rejected, papers failed, total duration ms,
  rejection reasons grouped by count.
- Use `zod` to validate the request body and to validate parser output shape
  (title, url, optional date) before it flows into the content gate.
- No route/module calls Oxylabs or Supabase service-role client from client code;
  everything scrape-related lives in server-only modules under `lib/scraping/`.

## Security requirements
- `x-radar-admin-secret` required and checked server-side only; never read from a
  browser-exposed env var.
- `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD` used only inside `lib/scraping/oxylabs.ts`,
  never logged in full (safe to log status codes/durations only).
- No secrets in query strings; Oxylabs basic auth stays in request headers.

## Acceptance criteria
- `npm run typecheck` and `npm run lint` pass.
- `POST /api/scrape` without the admin secret header returns 401.
- `POST /api/scrape` with the header, called with no body, scrapes all 5 seeded
  active sources (up to 5 valid papers each) and returns a summary object matching
  the shape in §9.
- Inserted papers satisfy the schema: non-null `published_at`, non-empty `raw_text`,
  no duplicate `original_url`, valid `source_id`.
- No source landing/listing/category page is ever inserted as a paper.
- A single source's Oxylabs failure doesn't stop the other 4 sources from running.
- Re-running immediately after a successful run inserts 0 new duplicate papers
  (dedupe works) and logs "duplicates skipped" > 0 if the same candidates reappear.

## Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build` (new route + server modules touch the build)

## Manual test steps (after implementation)
1. Run the seed SQL from `supabase/schema.sql` against the Supabase project
   (SQL Editor) to insert the 5 sources.
2. Start the dev server: `npm run dev` — keep this terminal visible for scrape logs.
3. In another terminal, trigger a full scrape:
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "x-radar-admin-secret: $RADAR_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
4. Confirm the JSON response contains the run summary (papers inserted, rejected,
   duplicates skipped, etc.) and that the dev server terminal shows per-source
   progress logs.
5. Optionally scrape a subset:
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "x-radar-admin-secret: $RADAR_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"perSourceLimit": 2}'
   ```
6. Verify in Supabase (Table Editor → `papers`) that rows exist with correct
   `source_id`, non-null `published_at`, and cleaned `raw_text` (no nav/script junk).
7. Re-run step 3's curl again and confirm the response shows 0 new duplicate
   inserts and a non-zero "duplicates skipped" count.
