# pgvector related research + global paper/repo search

## Goal
1. Enable pgvector, add an `embedding vector(1536)` column to `paper_analyses`, and generate
   embeddings (OpenAI `text-embedding-3-small`) as part of the AI analysis pipeline.
2. Add a "Related Research" feature on the paper/repo details page driven by cosine similarity
   over embeddings, replacing the current same-category placeholder.
3. Add a general search on the home page that matches across all papers and repos, with a
   filter to narrow results to just papers or just repos.

## Skills read
- ai-sdk (bundled docs at `node_modules/ai/docs/03-ai-sdk-core/30-embeddings.mdx`) — `embed()` API,
  model string `openai/text-embedding-3-small`, 1536 dimensions.
- supabase / supabase-postgres-best-practices — no dedicated pgvector rule file found; using
  Postgres's own pgvector docs pattern (SQL function + `.rpc()` from supabase-js), consistent with
  AGENTS.md's joined-table-filter gotcha (supabase-js can't `order by` a raw `<=>` expression, so a
  SQL function is required, not a guess).

## Existing code inspected
- `supabase/schema.sql`, `lib/supabase/types.ts` — current `paper_analyses` shape.
- `lib/ai/analyzePaper.ts`, `lib/ai/pipeline.ts`, `lib/ai/model.ts` — analysis generation uses
  Gemini/Ollama (`getAnalysisModel`), unrelated to the embedding model.
- `lib/supabase/queries/papers.ts` (pending-analysis LEFT JOIN pattern), `paperAnalyses.ts`.
- `app/page.tsx`, `app/papers/page.tsx`, `app/repos/page.tsx`, `app/papers/[id]/page.tsx` — all read
  via `getPapersForDisplay()`; `kind` (`"paper" | "repo"`) is derived from
  `source.parser_strategy === "github_trending"`.
- `components/research-radar/browse-view.tsx` — already has a text search box (searches title +
  neutral_summary) and a placeholder string "Search papers and repos..." but no kind filter, and
  each page pre-filters items to one kind before handing them to `BrowseView`.
- `components/research-radar/paper-detail-panel.tsx` — "Related Research" is currently same-category
  items from the already-loaded list (explicit comment marking it a placeholder until pgvector).

## Decisions / assumptions
- Embedding input text: `${title}\n\n${neutral_summary}` (short, on-topic, cheap) rather than
  `raw_text` (long, costs more tokens, mostly noise for similarity). This is my call — flag if you
  wanted raw_text instead.
- Embedding generation happens in the analyze pipeline right after a successful analysis, using the
  OpenAI provider directly (`@ai-sdk/openai`'s `text-embedding-3-small`) — independent of
  `getAnalysisModel()`, per AGENTS.md section 20's explicit requirement.
- `analyzed_at` is only set after both the analysis row and its embedding are saved in the same
  request, so no separate backfill pass is needed for newly analyzed papers.
- Backfill for pre-existing `paper_analyses` rows with `embedding IS NULL` (created before this
  change): the analysis pipeline additionally checks for these and embeds them without
  re-running the LLM analysis call.
- Related papers: cosine distance (`<=>`) via a SQL function `match_related_papers`, called through
  `supabase.rpc()`, limit 5, excludes the current paper, requires `embedding is not null`. Matches
  section 20's spec.
- Search: the home page (`/`) already loads all items (paper + repo mixed), so it's the natural home
  for a general search. `/papers` and `/repos` stay scoped to one kind (no change there). Adding a
  kind filter only makes sense where both kinds are present, so `BrowseView` gets an optional
  `showKindFilter` prop, passed only from `app/page.tsx`.
- Search matches title, neutral_summary, and core_methodology (client-side substring match on
  already-fetched data — no new backend search infra, consistent with §2 Simplicity First; this is
  not semantic/vector search, just broader field coverage for the existing text box).

## Files likely to change
- `supabase/schema.sql` — pgvector extension note, `embedding vector(1536)` column + ALTER migration
  block, ivfflat cosine index, `match_related_papers` SQL function.
- `lib/supabase/types.ts` — `embedding: number[] | null` on `PaperAnalysisRow`/`Insert`.
- `lib/ai/embedPaper.ts` (new) — thin wrapper calling `embed()` with the OpenAI provider.
- `lib/ai/analyzePaper.ts` — call the embed wrapper, include `embedding` in the returned insert.
- `lib/ai/pipeline.ts` — after the existing pending-analysis loop, run a second pass over
  analysis rows with `embedding IS NULL` and backfill just the embedding.
- `lib/supabase/queries/papers.ts` — nothing needed for the main pending check (unchanged); no new
  query here.
- `lib/supabase/queries/paperAnalyses.ts` — `updatePaperAnalysisEmbedding(paperId, embedding)`,
  `getAnalysesMissingEmbedding()`, `getRelatedPapers(paperId, embedding)` (via `.rpc()`).
- `app/papers/[id]/page.tsx` — fetch related papers server-side via `getRelatedPapers` when the
  selected item has an embedding; pass down instead of the in-component category placeholder.
- `components/research-radar/paper-detail-panel.tsx` — accept `related: PaperDisplayItem[]` as a
  prop instead of computing it from the sibling list; hide the section when empty.
- `components/research-radar/browse-view.tsx` — optional `showKindFilter` prop; kind filter pills
  (All / Papers / Repos); broaden search predicate to include `core_methodology`.
- `app/page.tsx` — pass `showKindFilter`.
- `.env.example` — already has `OPENAI_API_KEY`, no change needed.

## Implementation requirements
- Enable the `vector` extension via `create extension if not exists vector;` in schema.sql (must
  also be enabled once in Supabase Dashboard → Database → Extensions, since schema.sql is not
  auto-run).
- `alter table public.paper_analyses add column if not exists embedding vector(1536);` as a
  migration block (same append-only migration style already used for `primary_category`).
- IVFFlat cosine index: `create index ... using ivfflat (embedding vector_cosine_ops) with (lists = 100);`
  guarded with `if not exists`.
- `match_related_papers(query_embedding vector(1536), match_paper_id uuid, match_count int)` SQL
  function (`security definer` not needed — table already has public select policies), returns
  paper_id + distance, filtering `embedding is not null and paper_id <> match_paper_id`, ordered by
  `embedding <=> query_embedding`, limited to `match_count`.
- `getRelatedPapers` calls the RPC, then joins the returned paper_ids back to full `PaperDisplayItem`s
  by reusing the existing `joinPapersWithAnalysisAndSource`-style logic (fetch papers/analyses/sources
  by id, assemble in JS) — do not `.eq()` a joined table's column (AGENTS.md §21 gotcha).
- Pipeline logging: log embedding backfill progress and failures the same way analysis progress is
  logged (`[analyze]` prefix), and include counts in the final summary object.
- If embedding generation fails for a paper mid-analysis, do not save the analysis row with a null
  embedding and mark it analyzed — treat it as a failed paper for that run (same failure handling as
  a bad LLM analysis), so it retries as "pending" next run. Exception: pure backfill passes (analysis
  already saved) just retry that paper next run on failure — no new state to roll back.
- Do not implement true full-text/semantic search infra for the home page search — client-side
  substring filtering over the already-loaded list, as described in Decisions.

## Security requirements
- No new secrets exposed to the browser; embedding calls happen only inside `/api/analyze`
  (server-only route), same as existing analysis calls.
- `OPENAI_API_KEY` stays server-only (already documented in `.env.example`/AGENTS.md table).
- `match_related_papers` only exposes data already covered by the public-read RLS policy on
  `paper_analyses`/`papers`/`sources` — no new data exposure.

## Acceptance criteria
- `npm run typecheck` and `npm run lint` pass.
- Running `POST /api/analyze` on papers with no analysis: analysis + embedding both saved,
  `analyzed_at` set, in one pass.
- Running `POST /api/analyze` again with everything already analyzed: backfill pass finds 0 rows
  missing embedding (no-op), pipeline still completes and logs a clean summary.
- Manually nulling one row's `embedding` in Supabase and re-running `POST /api/analyze` backfills
  just that row's embedding (no re-analysis, no LLM analysis call for that paper).
- Opening a paper/repo details page for an item with an embedding shows "Related Research" populated
  by real cosine-similarity results (verify by checking they differ from the old same-category logic
  on a case with mixed categories).
- Opening a details page for an item with no embedding (e.g. before running `/api/analyze` after this
  change) hides the Related Research section instead of erroring.
- On `/`, typing a query (e.g. "embedding") returns matching items from both papers and repos, and the
  kind filter pills correctly narrow to just one kind on top of the text query. `/papers` and `/repos`
  are unaffected (no kind pills there, since they're already single-kind).

## Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build` (routes and server modules changed)

## Manual test steps
1. In Supabase Dashboard → Database → Extensions, enable `vector` (one-time).
2. Run the ALTER/index/function SQL from `supabase/schema.sql` in the SQL Editor (one-time).
3. Start the dev server: `npm run dev` (watch its terminal for `[analyze]` logs).
4. Trigger analysis (fills in embeddings for anything pending):
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-radar-admin-secret: $RADAR_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
5. In Supabase, confirm `paper_analyses.embedding` is populated for analyzed rows.
6. Visit `/`, open a paper/repo with an embedding, confirm "Related Research" shows similar items.
7. On `/`, search "embedding" (or any term you know appears in a stored paper/repo) and toggle the
   All/Papers/Repos pills to confirm filtering works.
