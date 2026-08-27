# Supabase database + data access layer

## Goal
Stand up the Supabase schema (sections 7 & 21 of AGENTS.md) and a typed, server-only data access layer for it. This is schema + data access only — no scraping, AI analysis, or UI wiring in this task (those are separate prompts). pgvector/embeddings are explicitly deferred to a later task (section 20).

## Skills read
- `.agents/skills/supabase/SKILL.md` (core principles, security checklist, CLI/MCP usage, migration workflow)

## Existing code inspected
- `package.json` — no `@supabase/supabase-js` dependency yet, no `supabase/` CLI config.
- `lib/` — only `lib/utils.ts` exists; no `lib/supabase/` yet.
- `app/page.tsx`, `app/papers/[slug]/page.tsx` — currently render hardcoded `MOCK_PAPERS` / `PAPER` objects with fields: slug, title, excerpt, imageUrl, categories (string[]), difficulty (beginner/intermediate/expert), publishedLabel, readTimeLabel, source, originalUrl, difficultyScore, confidence, generatedLabel, keyTakeaways (3 bullets), disclaimer, body (paragraphs). These pages are **not** touched by this task — noted only so the schema/types anticipate the fields the UI will eventually need.
- `.env.local` — has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PASSWORD` populated (project ref `uvhkxolxokqsuanhvifs`). No `RADAR_ADMIN_SECRET` yet (not needed for this task — no action routes are being built here).
- No `supabase/` directory, no Supabase CLI login, no Docker, no `psql` installed locally. `npx supabase --version` works (2.115.0) but `supabase login`/local stack are unavailable in this environment.

## Decisions / assumptions
1. **Migration execution method**: since the Supabase CLI isn't authenticated and there's no local Postgres/psql/Docker, apply the schema by writing a one-off Node script that connects directly to the Postgres instance using the `pg` package (dependency added temporarily is fine, or use `postgres` package) with a connection string built from `SUPABASE_PASSWORD` + the project ref, then run `supabase/schema.sql` against it. This matches AGENTS.md's instruction that `supabase/schema.sql` is the source of truth to update whenever fields change.
2. Following AGENTS.md's imperative-schema-file convention (not the CLI's declarative `supabase/schemas/` folder), so the skill's declarative-schema workflow is skipped; this project keeps one hand-maintained `supabase/schema.sql`.
3. `embedding vector(1536)` column is **not** included yet (section 20 defers it). `pgvector` extension is not enabled in this task.
4. RLS: UI must only ever read data written by the server-side pipeline; there is no end-user-owned row data (no `user_id` columns) in these tables. All six tables will have RLS enabled per the skill's security checklist. Since there are no browser-facing writes and reads should be public (papers/analyses power a public dashboard), policies will be: `anon`/`authenticated` get SELECT on `papers`, `paper_analyses`, `sources`; `logs`, `oxylabs_schedules`, `oxylabs_schedule_runs` get no anon/authenticated policies (service-role only, since service role bypasses RLS by default) — no public policies needed for those three.
5. Data access layer lives in `lib/supabase/`: `client.ts` (browser/publishable client using anon key, if ever needed by client components), `server.ts` (service-role client, server-only, used by pipeline/data access), `types.ts` (hand-written TS types matching schema.sql), `queries/` (one file per table group: `sources.ts`, `papers.ts`, `logs.ts`, `schedules.ts`). Only read/write helper functions actually needed to support the schema are added now — no scraping/AI/UI functions.
6. Package to add: `@supabase/supabase-js` (pinned version, lockfile committed). No `@supabase/ssr` yet since Clerk (not Supabase Auth) handles auth per AGENTS.md section 6, and no cookie-based session reading is needed for this task.

## Files likely to change
- `supabase/schema.sql` (new)
- `lib/supabase/client.ts` (new)
- `lib/supabase/server.ts` (new)
- `lib/supabase/types.ts` (new)
- `lib/supabase/queries/sources.ts` (new)
- `lib/supabase/queries/papers.ts` (new)
- `lib/supabase/queries/logs.ts` (new)
- `lib/supabase/queries/schedules.ts` (new)
- `package.json` / `package-lock.json` (add `@supabase/supabase-js`)
- `.env.example` (new — canonical env var list per AGENTS.md section 21, Supabase-relevant rows only for now)

## Implementation requirements
1. **Schema** (`supabase/schema.sql`), matching AGENTS.md section 7 exactly:
   - `sources`: id (uuid pk default gen_random_uuid()), name (text not null), listing_url (text not null unique), parser_strategy (text, nullable), is_active (boolean not null default true), logo_url (text, nullable), created_at (timestamptz not null default now()).
   - `papers`: id (uuid pk), source_id (uuid fk -> sources, not null), original_url (text not null unique), canonical_url (text, nullable), title (text not null), image_url (text, nullable), published_at (timestamptz not null), raw_text (text not null), scraped_at (timestamptz not null default now()), analyzed_at (timestamptz, nullable), created_at (timestamptz not null default now()).
   - `paper_analyses`: id (uuid pk), paper_id (uuid fk -> papers, not null, unique — one analysis per paper), neutral_summary (text not null), technical_difficulty_score (smallint not null, check between 1 and 10), difficulty_label (text not null, check in beginner/intermediate/expert), core_methodology (text not null), key_takeaways (text[] not null, check array_length = 3), confidence (numeric not null, check between 0 and 1), disclaimer (text not null), model_name (text not null), created_at (timestamptz not null default now()).
   - `logs`: id (uuid pk), level (text not null, check in info/warn/error), message (text not null), context (jsonb, nullable), created_at (timestamptz not null default now()).
   - `oxylabs_schedules`: id (uuid pk), source_id (uuid fk -> sources, not null, unique), oxylabs_schedule_id (text not null — stored as text per the skill's large-integer precision rule in AGENTS.md section 18), cron_expression (text not null), is_active (boolean not null default true), created_at (timestamptz not null default now()).
   - `oxylabs_schedule_runs`: id (uuid pk), schedule_id (uuid fk -> oxylabs_schedules, not null), oxylabs_run_id (text not null), oxylabs_job_id (text, nullable), result_status (text not null), processed_at (timestamptz, nullable), created_at (timestamptz not null default now()).
   - Add indexes: `papers(source_id)`, `papers(analyzed_at)` (for pending-analysis LEFT JOIN scans), `paper_analyses(paper_id)`, `logs(created_at desc)`, `oxylabs_schedule_runs(schedule_id)`.
   - Enable RLS on all six tables. Add SELECT-only policies for `anon, authenticated` on `sources`, `papers`, `paper_analyses` (`using (true)`, since this is public dashboard data with no per-row ownership). No policies for `logs`, `oxylabs_schedules`, `oxylabs_schedule_runs` — service role bypasses RLS, no other role should touch them.
2. **Apply the schema** to the linked Supabase project (uvhkxolxokqsuanhvifs) using the direct-connection Node script approach from decision 1. Verify tables exist afterward with a read-only query.
3. **Data access layer** (`lib/supabase/`):
   - `server.ts`: exports a function creating a Supabase client with the service-role key, server-only (add `import "server-only"` or equivalent guard if the package is available; otherwise a comment noting server-only usage — check what's already installed before adding a new dependency for this alone).
   - `client.ts`: exports a function creating a Supabase client with the publishable/anon key, safe for client components, using `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - `types.ts`: hand-written TypeScript types/interfaces for each table's row shape (matches schema.sql exactly), plus Insert variants where useful.
   - `queries/sources.ts`: `getActiveSources()`, `getSourceById(id)`.
   - `queries/papers.ts`: `getPaperByOriginalUrl(url)`, `getExistingOriginalUrls(urls: string[])` (chunked, max 15 per `.in()` call per the shared URL-existence-check rule in AGENTS.md section 9), `insertPaper(data)`, `getPendingAnalysisPapers(limit?)` (LEFT JOIN papers to paper_analyses, no row in paper_analyses = pending — implement in JS after an unfiltered fetch, not a broken joined-table `.eq()` filter, per the skill's Supabase gotcha), `getPapersWithAnalysis(limit?, offset?)`, `getPaperBySlugOrId(...)` only if a slug concept already exists in schema (it doesn't — skip; use paper id for now, UI wiring will decide slugs later).
   - `queries/logs.ts`: `insertLog(level, message, context?)`, `getRecentLogs(limit?)`.
   - `queries/schedules.ts`: `getScheduleBySourceId(sourceId)`, `upsertSchedule(...)`, `insertScheduleRun(...)`, `getDoneRunsForSchedule(scheduleId)`.
   - All query functions use the service-role client from `server.ts` (this is pipeline/server-only code, never imported into client components).

## Security requirements
- Service role key never imported into any file reachable from client components; `lib/supabase/server.ts` is the only place it's read.
- RLS enabled on every table; anon/authenticated get SELECT-only on public-facing tables; no policies (service-role only) on internal pipeline tables.
- No `SECURITY DEFINER` functions needed for this task — skip.
- `.env.example` lists only variable names/purpose, no real values.

## Acceptance criteria
- `supabase/schema.sql` runs cleanly against the linked project with no errors.
- `select * from information_schema.tables where table_schema='public'` shows all six tables.
- `npx supabase db advisors` or equivalent security check run against the project (skip if CLI auth unavailable — note explicitly if skipped rather than silently omitting).
- `lib/supabase/types.ts` types compile and match schema.sql columns exactly.
- Each `queries/*.ts` function has correct types (no `any`) and compiles under `npm run typecheck`.
- No RLS policy allows anon/authenticated write access anywhere.

## Checks to run
- `npm run typecheck`
- `npm run lint`
(no `npm run build` needed — no routes/pages change in this task)

## Manual test steps after implementation
1. Confirm schema applied: run the verification query (`select table_name from information_schema.tables where table_schema = 'public' order by 1;`) via the same direct-connection script and share output.
2. In a throwaway Node/tsx script (or `node -e`), import `getActiveSources` from `lib/supabase/queries/sources.ts` and log the result — expect an empty array (no sources inserted yet) with no errors.
3. Confirm RLS: use the anon client (`lib/supabase/client.ts`) to `select * from papers` — expect empty array (RLS SELECT policy allows it, table has 0 rows) and no `permission denied` error.
4. Confirm RLS blocks unintended writes: attempt an anon-client `insert` into `papers` — expect a permission/RLS error (no INSERT policy exists for anon).
