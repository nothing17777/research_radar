# Oxylabs Scheduler + Vercel Cron automatic pipeline

## Goal
Implement the full automatic hourly pipeline per AGENTS.md §18: Oxylabs Scheduler
creates hourly scraping jobs per active source, a Vercel Cron job fires 15 minutes
later, processes completed Oxylabs runs into papers, then runs AI analysis on
anything pending — with zero manual intervention once set up.

## Skills read
- .agents/skills/oxylabs-web-scraper (SKILL.md) — general Web Scraper API usage,
  auth, request/response shape.
- Scheduler API docs fetched live from
  https://developers.oxylabs.io/products/web-scraper-api/features/scheduler
  (per AGENTS.md §18 — must not rely on training memory):
  - `POST https://data.oxylabs.io/v1/schedules` — create. Body: `cron` (string),
    `items` (array of job param sets, e.g. `{source:"universal", url}`), `end_time`
    (string timestamp). Response: `schedule_id` (int), `active`, `items_count`,
    `cron`, `end_time`, `next_run_at`.
  - `GET https://data.oxylabs.io/v1/schedules` — list. Response: `schedules` (array
    of schedule IDs).
  - `GET https://data.oxylabs.io/v1/schedules/{id}/runs` — Response: `runs[]`, each
    with `run_id`, `jobs[]` (`id`, `create_status_code`, `result_status`,
    `created_at`, `result_created_at`), `success_rate`.
  - `GET https://data.oxylabs.io/v1/schedules/{id}/jobs` — flat job ID list only,
    no status (per AGENTS.md §18, do not use this for processing — use `/runs`).
  - `PUT https://data.oxylabs.io/v1/schedules/{id}/state` — body `{ "active": bool }`.
  - Job **results** (actual scraped HTML) are fetched via the existing Push-Pull
    results endpoint pattern used elsewhere in Oxylabs docs for a given job id —
    `GET https://data.oxylabs.io/v1/queries/{job_id}/results`. Fetch this at
    processing time for each `id` in a run's `jobs[]` where `result_status === "done"`.

## Existing code inspected
- `lib/scraping/oxylabs.ts` — `scrapeUrl()` used for live/manual fetch via Realtime
  endpoint. Scheduler needs separate helper functions (different base URL/endpoints).
- `lib/scraping/pipeline.ts` / `app/api/scrape/route.ts` — canonical manual
  scrape-to-insert flow (fetch listing → parser.extractCandidates → dedupe via
  `getExistingOriginalUrls` (15-url chunks) → parser.parseDetail on each candidate
  → `validatePaper` → `insertPaper`). `runSource()` currently fetches the listing
  HTML itself via `scrapeUrl`; needs to be refactored so the candidate-extraction-
  through-insert logic can run on HTML obtained a different way (from an Oxylabs
  job result) without duplicating logic, per AGENTS.md §18 ("do not duplicate
  pipeline logic inside Scheduler").
- `lib/supabase/queries/schedules.ts` — already has `getScheduleBySourceId`,
  `upsertSchedule`, `insertScheduleRun`, `getDoneRunsForSchedule` (filters
  `result_status = 'done'` and `processed_at IS NULL`).
- `lib/supabase/queries/logs.ts` — `insertLog(level, message, context)`,
  `getRecentLogs(limit)`. Already used throughout the manual pipeline.
- `lib/supabase/types.ts` — `OxylabsScheduleRow`/`Insert`, `OxylabsScheduleRunRow`/
  `Insert` already defined and match `supabase/schema.sql`.
- `lib/ai/pipeline.ts` / `app/api/analyze/route.ts` — `runAnalysisPipeline()`, takes
  `{ limit?, paperIds? }`, already handles pending-analysis detection + embeddings.
- `app/api/scrape/route.ts`, `app/api/analyze/route.ts` — pattern for
  `x-radar-admin-secret` header check (401 on missing/invalid) to replicate on new
  action routes.
- No `vercel.json` exists yet in the repo root.

## Decisions / assumptions
- **Large integer IDs**: `schedule_id` and job `id` values from Oxylabs are read by
  string-extracting from the raw response body (regex on the raw text) before any
  `JSON.parse`, per AGENTS.md §18. A small helper
  `lib/scraping/oxylabsSchedulerClient.ts` will expose functions that return these
  IDs as strings, never as parsed JS numbers.
- **Shared pipeline logic refactor**: extract a `processListingHtml(source, html,
  perSourceLimit)` function from `lib/scraping/pipeline.ts`'s `runSource` that
  contains steps 3–8 of the canonical pipeline (candidate extraction through
  insert). `runSource` (manual, live fetch) and a new
  `processScheduledSource(source, scheduleRun, html, perSourceLimit)` (scheduler)
  both call it. This satisfies "reuse the same validation, cleanup, dedupe, and
  console summary logging" (§18) without duplicating logic.
- **Sync route creates one schedule per active source**: each schedule's `items`
  contains a single `{source: "universal", url: listing_url, render: "html"}` job,
  cron `"0 * * * *"` (hourly), `end_time` set 1 year out (re-run sync to renew).
- **Orphan deactivation**: after creating/updating schedules for all active
  sources, list all Oxylabs schedules via `GET /v1/schedules`, diff against
  `oxylabs_schedules.oxylabs_schedule_id` values in the DB, and PUT
  `{active: false}` on any Oxylabs schedule ID not present in the DB.
- **Manual process route** processes runs for all schedules (or specific
  `scheduleIds` if given in the body), not tied to a single source, mirroring the
  manual scrape route's shape.
- **Cron secret**: `CRON_SECRET` read from `process.env`, only enforced when
  `process.env.NODE_ENV !== "development"`, matching AGENTS.md §18's explicit
  local-dev exemption. Never added to `.env.local`.
- **ANALYSIS_BATCH_SIZE / default per-source limit**: reuse `DEFAULT_PER_SOURCE_LIMIT
  = 5` (already in `lib/scraping/pipeline.ts`) for scheduled processing too.

## Files likely to change
- `lib/scraping/pipeline.ts` — refactor to extract `processListingHtml`; export it.
- `lib/scraping/oxylabsSchedulerClient.ts` (new) — thin client for the 5 Scheduler
  endpoints above, with raw-text ID extraction.
- `lib/scraping/schedulerPipeline.ts` (new) — `syncSchedules()` (create/update +
  orphan deactivation) and `processScheduledRuns(options)` (fetch done runs →
  fetch job result HTML → `processListingHtml` → mark `processed_at`).
- `app/api/oxylabs/schedules/route.ts` (new) — `POST` (sync/create, admin secret) +
  `GET` (list stored schedule rows, admin secret) per AGENTS.md §14.
- `app/api/oxylabs/scheduled-results/process/route.ts` (new) — `POST` (admin
  secret), calls `processScheduledRuns`.
- `app/api/cron/pipeline/route.ts` (new) — `GET`, `CRON_SECRET`-protected (skipped
  in dev), runs `processScheduledRuns()` then `runAnalysisPipeline({})` in
  sequence; step two always runs even if step one throws.
- `vercel.json` (new) — cron entry for `/api/cron/pipeline` at `15 * * * *`.
- `.env.example` — add `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD` if missing (check
  first), do not add `CRON_SECRET`.
- `lib/supabase/queries/schedules.ts` — add `getAllSchedules()` and
  `markScheduleRunProcessed(id)` if not already coverable by existing functions.

## Implementation requirements
- Reuse `insertLog` + the same console log message style (`[scheduler]` prefix)
  as `[scrape]`/`[analyze]` for run start/per-schedule/completion/error lines.
- `processScheduledRuns` must return a summary object shaped like
  `ScrapeRunSummary` (reuse the type / a superset) so the route response and logs
  are consistent with manual scraping.
- `GET /api/oxylabs/runs` is not in the original required list for this task
  (was in AGENTS.md §14 as a status route) — only add if trivial; skip if it adds
  meaningful scope beyond what's needed to test this feature manually.
- Do not save scheduled landing page HTML as a paper (only detail pages after
  validation, same as manual).
- Do not call browser/OpenAI/Oxylabs code from client components — everything
  above is server-only route handlers / lib modules.

## Security requirements
- `/api/oxylabs/schedules` (POST) and `/api/oxylabs/scheduled-results/process`
  require `x-radar-admin-secret` matching `RADAR_ADMIN_SECRET`, 401 otherwise.
- `/api/oxylabs/schedules` (GET) also requires the admin secret (read route for
  internal pipeline config, not public dashboard data).
- `/api/cron/pipeline` (GET) requires `CRON_SECRET` header match in non-dev, 401
  otherwise; never checks `RADAR_ADMIN_SECRET`.
- No Oxylabs/OpenAI/Supabase service-role credentials touch client code.

## Acceptance criteria
- Running the sync route creates exactly one active Oxylabs schedule per active
  source and a matching `oxylabs_schedules` row.
- Re-running sync after a source becomes inactive deactivates its Oxylabs
  schedule remotely and does not error.
- Processing route only ingests `result_status === 'done'` runs, skips
  already-`processed_at` runs, and inserts papers using the exact same
  validation/dedupe path as manual scraping (verified by code reuse, not
  duplication).
- Cron route runs step two (analysis) even when step one throws.
- Cron route returns 401 in production without a valid `CRON_SECRET`, and works
  without one in local dev.
- `npm run typecheck` and `npm run lint` pass.

## Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build` (routes + config changed)

## Manual test steps (to share after implementation)
- `curl -X POST http://localhost:3000/api/oxylabs/schedules -H "x-radar-admin-secret: $RADAR_ADMIN_SECRET"`
  → creates/updates schedules, confirm `oxylabs_schedules` rows in Supabase.
- `curl http://localhost:3000/api/oxylabs/schedules -H "x-radar-admin-secret: $RADAR_ADMIN_SECRET"`
  → lists stored schedule rows.
- `curl -X POST http://localhost:3000/api/oxylabs/scheduled-results/process -H "x-radar-admin-secret: $RADAR_ADMIN_SECRET"`
  → processes any done runs; watch dev server terminal for `[scheduler]` logs.
- `curl http://localhost:3000/api/cron/pipeline` (no secret needed in dev) →
  runs process + analyze in sequence; watch terminal for both `[scheduler]` and
  `[analyze]` logs.
- Confirm `vercel.json` cron entry only after deploying to Vercel (cannot be
  tested locally).
