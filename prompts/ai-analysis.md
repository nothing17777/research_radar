# AI Paper Analysis Pipeline (Step 5) — Hybrid Ollama (dev) / Gemini (prod)

## Goal
Implement `POST /api/analyze`: analyze pending papers (no `paper_analyses` row) using the Vercel AI SDK's `generateObject`, routed to a local Ollama model in development and Gemini in production via a single `getAnalysisModel()` helper. Validate output with Zod, persist to `paper_analyses` (including two new columns), and stamp `analyzed_at` only after a successful write.

## Skills read
- AGENTS.md section 19 (AI analysis and UI framing — translated below), section 7 (schema source of truth), section 15 (admin secret), section 14 (API method rules).
- `.agents/skills/ai-sdk/SKILL.md` — mandates installing the actual, version-matched packages and reading their bundled docs before writing `generateObject` code; explicitly forbids trusting memory for package names or model IDs.

## Correction to the request — please confirm before I proceed
`@ai-sdk/ollama` **does not exist** (verified: `npm view @ai-sdk/ollama` → 404). There is no official Vercel AI SDK Ollama provider. The real options are:

1. **`ollama-ai-provider`** (third-party, community-maintained, exports `ollama(...)` exactly as you described). Verified on npm: latest `1.2.0`, published 2025-01-17. Risk: it depends on `@ai-sdk/provider@^1.0.0`, while `@ai-sdk/google` (verified latest `4.0.51`) is on the v4+ provider generation — these may be API-incompatible with each other and with whatever `ai` core version we install. Compatibility must be checked against the bundled docs/source at install time; if `generateObject` structured-output mode doesn't work reliably against it, this option is blocked.
2. **Ollama via its OpenAI-compatible endpoint**, using the official `@ai-sdk/openai` provider's `createOpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' })` pointed at a local Ollama server. This is Ollama's own documented compatibility mode and stays on the same actively-maintained official provider package already implied by our stack — no extra third-party dependency, no version-skew risk with `@ai-sdk/google`.

**Assumption (proceeding under this unless you say otherwise):** use option 2 (`@ai-sdk/openai` + Ollama's OpenAI-compatible endpoint) for local dev, since it avoids installing an unofficial, possibly-incompatible package. The implementation step will still verify `generateObject` works against Ollama's compatible endpoint against the bundled `@ai-sdk/openai` docs before finalizing — if it doesn't, I'll report that instead of silently degrading output quality.

Also: the model names `llama3` and `gemini-1.5-flash` are from your message, not independently verified against a live model list (the ai-sdk skill requires never trusting memory for model IDs). Implementation step will confirm `llama3` is pulled locally (`ollama list`) and that `gemini-1.5-flash` is still a current, non-deprecated Gemini model id before hardcoding it — swapping to a newer id if it's been superseded.

## Existing code inspected
- `lib/supabase/types.ts` — `PaperAnalysisRow`/`Insert`, `Database` type (no `primary_category`/`prerequisites` yet).
- `supabase/schema.sql` — `paper_analyses` table + constraints (8 columns: neutral_summary, technical_difficulty_score, difficulty_label, core_methodology, key_takeaways, confidence, disclaimer, model_name).
- `lib/supabase/queries/papers.ts` — `getPendingAnalysisPapers(limit?)` **already implements** the pending-analysis check (fetches `papers` + `paper_analyses`, diffs in JS — functionally the LEFT JOIN AGENTS.md section 19 requires, since supabase-js can't reliably filter joined-table nullness). Reuse as-is.
- `lib/supabase/queries/logs.ts` — `insertLog(level, message, context?)`.
- `app/api/scrape/route.ts` — reference pattern: admin-secret guard, Zod request parsing, summary-object response.
- `lib/scraping/pipeline.ts` — reference pattern: batch loop, per-item try/catch, summary accumulation, `console.log` progress.
- `package.json` — `ai`, `@ai-sdk/openai`, `@ai-sdk/google` are **not installed**. Must be added.

## Translating "political news bias" metrics → academic/technical evaluation parameters
Research Radar has no political dimension; AGENTS.md section 19 already defines the academic-domain equivalent of a bias/quality framework:
- *Objectivity* → **neutral, evidence-based summary** (`neutral_summary`): describe what the paper claims/does, not editorialize on novelty or importance.
- *Slant/leaning score* → **technical_difficulty_score (1–10) + difficulty_label**, explicitly framed as **AI-estimated, not objective truth** (per section 19), shown with a disclaimer rather than asserted as fact.
- *Source credibility weighting* → explicitly forbidden here: "use paper text evidence only, do not infer based on source brand alone" (section 19) — the model must not upgrade/downgrade an assessment because the source is a big lab vs. an unknown blog.
- *Key claims extraction* → `key_takeaways`: exactly 3 developer-focused, evidence-based action points.
- *Confidence in the bias call* → `confidence` (0.0–1.0), same role as a political-bias classifier's confidence score, but scoped to "how sure is the model in its technical read of this paper."
This is why the Zod schema below still requires `technical_difficulty_score`, `core_methodology`, and `disclaimer` even though your message's field list omitted them — they are the section 19 requirements that make the assessment auditable rather than an unqualified claim.

## Decisions / assumptions
1. **Schema migration** (you explicitly requested this): add to `paper_analyses`:
   - `primary_category text not null`
   - `prerequisites text[] null`
   These are additive; no existing column is removed or renamed.
2. Field mapping from your request to schema/DB columns (section 19 names win where they overlap):
   - `summary` → `neutral_summary`
   - `difficulty_level` → `difficulty_label` (enum unchanged: beginner/intermediate/expert, band-checked against `technical_difficulty_score` in code: 1–4/5–7/8–10)
   - `primary_category` → new column `primary_category`
   - `key_takeaways` → unchanged, exactly 3
   - `prerequisites` → new column `prerequisites`, nullable text[]
   - `confidence` → unchanged
   - `technical_difficulty_score`, `core_methodology`, `disclaimer`, `model_name` remain required per section 19 (see translation above).
3. `getAnalysisModel()` in `lib/ai/model.ts`:
   - `process.env.NODE_ENV === 'development'` → Ollama via `@ai-sdk/openai`'s `createOpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' })`, model id `llama3` (pending the `ollama list` check above).
   - otherwise → `google('gemini-1.5-flash')` from `@ai-sdk/google`, reading `GOOGLE_GENERATIVE_AI_API_KEY` (the SDK's documented env var name — to be confirmed against `@ai-sdk/google`'s bundled docs at implementation time, not assumed).
4. Batch size: `ANALYSIS_BATCH_SIZE` env var, default 5, overridable by request body `limit` or `paperIds` — same as prior plan, per section 19's "no fixed one-time batch" rule.
5. Invalid AI output: retry once, then mark that paper failed/skipped — never save partial/invalid analysis.
6. `analyzed_at` set only after the `paper_analyses` insert succeeds.
7. `disclaimer` is authored by our code as a fixed constant, not generated by the model, to keep wording consistent and always present even if the model omits nuance.

## Files likely to change
- `supabase/schema.sql` — add `primary_category`, `prerequisites`; include the `alter table` snippet for the user to run manually.
- `lib/supabase/types.ts` — extend `PaperAnalysisRow`/`PaperAnalysisInsert` with `primary_category: string`, `prerequisites: string[] | null`.
- `lib/ai/model.ts` (new) — `getAnalysisModel()`.
- `lib/ai/analyzePaper.ts` (new) — Zod output schema + one-retry `generateObject` call for a single paper.
- `lib/supabase/queries/paperAnalyses.ts` (new) — `insertPaperAnalysis(insert)`.
- `lib/supabase/queries/papers.ts` — add `markPaperAnalyzed(paperId)`.
- `lib/ai/pipeline.ts` (new) — batch orchestration, mirrors `lib/scraping/pipeline.ts` (fetch pending via `getPendingAnalysisPapers`, loop, insert + mark analyzed, accumulate summary, `insertLog` + console progress).
- `app/api/analyze/route.ts` (new) — `POST` handler: admin-secret guard, Zod body (`{ limit?, paperIds? }`), runs pipeline, returns summary.
- `package.json` — add `ai`, `@ai-sdk/openai`, `@ai-sdk/google`.
- `.env.example` — document `GOOGLE_GENERATIVE_AI_API_KEY` (name pending confirmation) alongside existing `OPENAI_API_KEY`-style entries; note Ollama needs no API key, only a running local server.

## Implementation requirements
- Install `ai`, `@ai-sdk/openai`, `@ai-sdk/google` first; read their bundled `node_modules/*/docs/` (structured output, provider construction, `createOpenAI` custom baseURL) before writing generation code.
- Verify locally that Ollama is running (`ollama list` / `ollama serve`) and that `llama3` supports tool/structured-output mode compatible with `generateObject` — Ollama's OpenAI-compat endpoint has had gaps in JSON-mode support historically; confirm against current Ollama docs, and report back if `llama3` doesn't support it (may need a tool-calling-capable model).
- Zod schema: `technicalDifficultyScore` 1–10 int; `difficultyLabel` enum consistent with score band (validated in code, not just by the enum); `keyTakeaways` exactly length 3; `confidence` 0–1; `primaryCategory` non-empty string; `prerequisites` optional string array.
- `POST /api/analyze` requires `x-radar-admin-secret` matching `RADAR_ADMIN_SECRET`; 401 otherwise.
- Default (no body): process all pending papers in batches of `ANALYSIS_BATCH_SIZE` until none remain in one request.
- `limit`: cap total papers processed. `paperIds`: process only those (skip non-pending ones, logged as skipped).
- No OpenAI/Gemini/Ollama or Supabase write calls from client/browser code — server route/lib modules only.
- Use the service-role Supabase client for all reads/writes.

## Security requirements
- `RADAR_ADMIN_SECRET`, `GOOGLE_GENERATIVE_AI_API_KEY` read from `process.env` only, never logged or echoed.
- Ollama calls target `localhost` only, never a remote host, and only run when `NODE_ENV === 'development'`.
- No secrets in the response summary.

## Acceptance criteria
- Missing/invalid admin header → 401, no work performed.
- Valid request analyzes all pending papers in batches, writes all 10 `paper_analyses` columns per paper, sets `analyzed_at`, returns `{ status, papersChecked, analyzed, skipped, failed, batches, durationMs, failureReasons, modelUsed }`.
- A paper failing validation twice: no `paper_analyses` row, `analyzed_at` stays null, counted under `failed`.
- Already-analyzed papers are never reprocessed (DB unique constraint on `paper_analyses.paper_id` backstops this).
- Running with `NODE_ENV=development` uses the local Ollama path with zero external API calls; running in production uses Gemini.
- `npm run typecheck` and `npm run lint` pass.

## Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build` (recommended — new route + schema types)

## Manual test steps (after implementation)
1. In Supabase Dashboard → SQL Editor, run the `alter table` statements for `primary_category`/`prerequisites`.
2. Ensure Ollama is running locally with `llama3` pulled: `ollama pull llama3` then `ollama serve` (if not already running as a service).
3. `.env.local`: `RADAR_ADMIN_SECRET`, `ANALYSIS_BATCH_SIZE` (optional). No Gemini key needed for local dev since `NODE_ENV=development` routes to Ollama.
4. `npm run dev`, watch terminal for `[analyze]` progress logs.
5. Trigger analysis:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-radar-admin-secret: $RADAR_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
6. Optional limit:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-radar-admin-secret: $RADAR_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"limit": 2}'
   ```
7. Verify in Supabase Table Editor: new `paper_analyses` rows with all fields populated (including `primary_category`, `prerequisites`), `papers.analyzed_at` set.
8. Re-run the same curl — should show 0 analyzed / all skipped (no pending papers left).
9. Before deploying, set `GOOGLE_GENERATIVE_AI_API_KEY` in the production environment (Vercel project settings) so the prod path (`NODE_ENV=production`) can reach Gemini.
