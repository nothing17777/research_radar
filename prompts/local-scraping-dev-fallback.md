# Local Scraping Fallback for Development

## Goal
Let `POST /api/scrape` work end-to-end locally without hitting Oxylabs (and its billing), by having `scrapeUrl()` fetch pages directly via a local HTTP request when `NODE_ENV === 'development'`, while production keeps using Oxylabs exactly as today. This mirrors the hybrid pattern already used for AI analysis (`lib/ai/model.ts`: Ollama in dev, Gemini in prod).

## Skills read
- AGENTS.md section 6 (tech stack — mandates Oxylabs Web Scraper API) and section 9 (canonical scrape-to-insert pipeline, uses Oxylabs for HTML). This change is a deliberate, scoped deviation for local dev/testing only — production behavior is unchanged.

## Existing code inspected
- `lib/scraping/oxylabs.ts` — `scrapeUrl(url, opts)` is the single entry point that fetches HTML via the Oxylabs Realtime API (`https://realtime.oxylabs.io/v1/queries`) using `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD`. Returns `{ content, statusCode, url }`.
- `lib/scraping/pipeline.ts` — calls `scrapeUrl(source.listing_url, {render: "html"})` for the listing page and `scrapeUrl(url, {render: "html"})` per candidate detail page. Everything downstream (parsers, dedupe, validation, `insertPaper`) only depends on the returned `content` string — no Oxylabs-specific fields are used elsewhere.
- `lib/scraping/parsers/*` — parse plain HTML with Cheerio; no dependency on how the HTML was fetched.
- `package.json` — `cheerio` is already a dependency; no new package needed for a plain `fetch`-based local path.

## Decisions / assumptions
1. Branch inside `scrapeUrl()` itself (same file, same exported function signature) rather than adding a second code path in `pipeline.ts` — keeps the pipeline oblivious to which fetch strategy is active, exactly like `getAnalysisModel()` keeps `analyzePaper.ts` oblivious to which AI provider is active.
2. Local dev fetch uses the platform `fetch()` with a realistic `User-Agent` header (many sites block the default Node/undici UA) and a reasonable timeout; it does not render JavaScript. Sites that require Oxylabs's JS rendering or bot-detection bypass (e.g. some blog frontends) may return blocked or incomplete HTML locally — that's an accepted limitation of this dev-only path, not a bug to work around with a headless browser (out of scope).
3. No Oxylabs credentials are required in development under this path. If `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD` are unset in development, the local fetch path is used instead of throwing.
4. Production behavior is byte-for-byte unchanged: `NODE_ENV === 'production'` (or anything other than `'development'`) always uses Oxylabs, and still throws if credentials are missing.
5. Non-2xx or network-failure responses from the local fetch throw the same shape of error `scrapeUrl` already throws for Oxylabs failures, so `pipeline.ts`'s existing per-source/per-candidate try/catch and rejection-reason logging need no changes.
6. `statusCode` from a local fetch is the real HTTP status; `url` is the final response URL (handles redirects) or the original URL if unavailable.

## Files likely to change
- `lib/scraping/oxylabs.ts` — add a local-fetch branch inside `scrapeUrl()`.

No other files change; `pipeline.ts`, parsers, types, and the `/api/scrape` route stay as-is.

## Implementation requirements
- `NODE_ENV === 'development'` → `fetch(url, { headers: { 'User-Agent': '<realistic browser UA>' } })`, read `.text()` for `content`, use `response.status` and `response.url`.
- Throw `Error("Local fetch failed for ${url}: ${response.status}")` on non-2xx, matching the existing Oxylabs failure message style.
- Otherwise (production) → existing Oxylabs Realtime API call, unchanged.
- No Oxylabs calls, credentials checks, or network calls to Oxylabs made at all when in the local dev branch.
- Server-only module (`import "server-only"` already present) — no change needed there.

## Security requirements
- No change to secret handling; local fetch requires no credentials.
- Local fetch still only runs server-side (same file/module as today).

## Acceptance criteria
- With `NODE_ENV=development` (i.e. `npm run dev`) and no Oxylabs credentials set, `POST /api/scrape` successfully fetches at least the arXiv and GitHub Trending sources (static HTML, least likely to be blocked) and inserts valid papers into Supabase.
- Sources that get blocked or return incomplete HTML locally (if any) fail gracefully with a per-source error captured in the run summary (`sources[].error`), exactly like an Oxylabs failure would — the run overall still completes and reports counts for the sources that succeeded.
- Running the same request against a production build/environment still calls Oxylabs exactly as before (verified by code inspection — no live prod call will be made during this session).
- `npm run typecheck` and `npm run lint` pass.

## Checks to run
- `npm run typecheck`
- `npm run lint`

## Manual test steps (after implementation)
1. Ensure `.env.local` has `RADAR_ADMIN_SECRET` (Oxylabs vars not required locally anymore).
2. `npm run dev`, watch terminal for `[scrape]` progress logs.
3. Trigger a small scrape:
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "x-radar-admin-secret: $RADAR_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"perSourceLimit": 2}'
   ```
4. Check the terminal logs and the JSON response for per-source results — expect `papersInserted` > 0 for at least the static-HTML sources.
5. Verify new rows in Supabase `papers` table.
6. Run `POST /api/analyze` afterward to confirm the newly scraped papers flow through the AI pipeline too.
