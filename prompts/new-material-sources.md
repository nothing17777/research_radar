# New material types: datasets, model cards, newsletters, video (this app)

## Goal
Expand the scraping pipeline beyond papers/repos to also track Hugging Face
datasets, Hugging Face model cards, and newsletter issue content, plus scaffold
a `video` kind for talk-transcript sources. This is the data-supply side for
the new "Scout" chat app (separate repo, same Supabase project) — Scout only
reads what this app scrapes/analyzes, so this app keeps owning Oxylabs/cron/
Supabase writes per the user's explicit decision.

## Skills read
- .agents/skills/oxylabs-web-scraper (SKILL.md) — already-used scraping patterns.
- .agents/skills/supabase (SKILL.md) — schema/query conventions.
- .agents/skills/ai-sdk (SKILL.md) — embedding model usage via the `ai` package.

## Existing code inspected
- `lib/scraping/parsers/huggingface.ts` — existing HF Papers parser: candidate
  links via `a[href^="/papers/"]`, detail via `h1` + `extractCleanText($,
  "main")` + a `publishedAt&quot;:&quot;...` regex on embedded JSON. HF Datasets
  (`/datasets`) and HF Models (`/models`) pages share Hugging Face's frontend,
  but their exact link/selector shape (`/datasets/{owner}/{name}` vs
  `/models/{owner}/{name}`, and whether the same publishedAt regex exists on
  those page types) has NOT been verified — fetch a live sample of each listing
  and detail page before writing selectors (AGENTS.md section 9: no invented
  URLs; this note extends that caution to invented selectors).
- `lib/scraping/parsers/githubTrending.ts` — pattern for a source with no
  reliable per-item publish date: `parseDetail` returns `publishedAt: null`,
  and `lib/scraping/pipeline.ts`'s `processListingHtml` special-cases
  `source.parser_strategy === "github_trending"` to stamp `new Date()`. Model
  cards need the same treatment (HF model pages don't reliably expose a
  publish date either).
- `lib/scraping/parsers/genericBlog.ts` — reusable as-is for newsletter issue
  pages (Substack-style posts already pass the existing body-quality gate);
  no new parser code needed for the newsletter kind, only a new source row
  tagged so it displays as `newsletter` rather than `paper`.
- `lib/supabase/queries/papers.ts` — `kindForSource(source)` currently maps
  `parser_strategy === "github_trending"` to `"repo"`, else `"paper"`.
  `ItemKind = "paper" | "repo"`.
- `components/research-radar/kind-icon.tsx` — hardcodes a two-way branch
  (`repo` vs everything-else-is-"Paper" fallback with a `FileText` icon).
- `lib/ai/model.ts` / `lib/ai/embedPaper.ts` — `getEmbeddingModel()` branches
  on `NODE_ENV === "development"` (Ollama `nomic-embed-text`, 768-dim,
  zero-padded to 1536) vs production (OpenAI `text-embedding-3-small`, paid,
  effectively unfunded per the user). `embedPaper` pads/validates to exactly
  1536 dims.
- `lib/ai/pipeline.ts` — already backfills embeddings for any
  `paper_analyses` row missing one (LEFT JOIN pending-detection, section 19/20),
  so switching the model going forward + nulling existing embeddings is enough
  to trigger a full backfill on the next `/api/analyze` run — no separate
  migration script needed beyond one SQL `update`.
- AGENTS.md section 9 non-paper reject list — newsletter *signup* pages are
  still rejected; actual newsletter issue content is now a valid source type
  (already edited into AGENTS.md this session).

## Decisions / assumptions
- **New parser strategies**: `huggingface_datasets` and `huggingface_models`
  (new parser modules, modeled on `huggingface.ts`); newsletters reuse
  `generic_blog` as their `parser_strategy` (no new parser) but get their own
  `kind` label via a new `is_newsletter` style distinction — see kind mapping
  below.
- **Kind mapping can't stay a single `parser_strategy` lookup for newsletters**
  since they share `generic_blog` with ordinary tech blogs. Add an explicit
  `content_kind` column to `sources` (nullable text, values:
  `null` (default → paper), `"repo"`, `"dataset"`, `"model"`, `"newsletter"`,
  `"video"`) so kind is a first-class source attribute instead of being
  inferred from `parser_strategy`. `kindForSource` becomes: read
  `source.content_kind` if set, else fall back to the existing
  parser-strategy-based inference (`github_trending` → `repo`, else `paper`)
  for backward compatibility with existing rows.
- **`ItemKind`** grows to
  `"paper" | "repo" | "dataset" | "model" | "newsletter" | "video"`.
- **Video is a scaffold, not a working scraper yet**: add the `video_talks`
  parser strategy and `video` kind end-to-end (types, icon, validation), but
  its `extractCandidates`/`parseDetail` will target a transcript-bearing talk
  page (e.g. a conference site that publishes full-text talk transcripts), NOT
  raw YouTube — YouTube caption data isn't reliably present in scraped HTML.
  Do not seed a YouTube source row. Ask the user for a real transcript-bearing
  listing URL before this parser can be tested end-to-end; if none is
  available yet, ship the parser as untested scaffolding and say so plainly.
- **No source rows are seeded with invented URLs.** After the parsers are
  built, ask the user for real listing URLs for: an HF Datasets listing, an HF
  Models listing, and a specific newsletter's archive page. Insert those as
  new `sources` rows (with the right `parser_strategy`/`content_kind`) once
  provided — this is a manual follow-up step, not part of this implementation
  pass, per AGENTS.md section 8 (ask which sources, never invent URLs).
- **Embeddings switch to Google in production**: `getEmbeddingModel()` uses
  `google.textEmbeddingModel("text-embedding-004")` (or the current
  `@ai-sdk/google` equivalent — verify the exact export name against the
  installed `@ai-sdk/google` version's docs before writing the import) instead
  of OpenAI in production, dimension parameter set to 1536 to match the
  existing `vector(1536)` column and avoid changing the schema. Dev keeps
  Ollama unchanged. `OPENAI_API_KEY`/`@ai-sdk/openai` embedding usage is
  removed from `model.ts`; check whether `@ai-sdk/openai` is still needed for
  anything else in the codebase before removing the dependency itself (search
  first — don't remove a package still in use elsewhere).
- **Backfill**: after switching the model, run
  `update paper_analyses set embedding = null;` once in Supabase SQL editor
  (share this as a manual step, do not run destructive SQL automatically),
  then call `POST /api/analyze` to backfill all embeddings under the new model.

## Files likely to change
- `supabase/schema.sql` — add `content_kind text` to `sources`; update the
  `match_related_papers` function only if needed (it's kind-agnostic already,
  no change expected there).
- `lib/supabase/types.ts` — add `content_kind` to `SourceRow`/`SourceInsert`.
- `lib/supabase/queries/papers.ts` — update `kindForSource`.
- `components/research-radar/kind-icon.tsx` — icon per kind (dataset, model,
  newsletter, video) instead of a two-way branch.
- `lib/scraping/parsers/huggingfaceDatasets.ts` (new)
- `lib/scraping/parsers/huggingfaceModels.ts` (new)
- `lib/scraping/parsers/videoTalks.ts` (new, scaffold)
- `lib/scraping/parsers/index.ts` — register the 3 new strategies.
- `lib/scraping/pipeline.ts` — extend the "no reliable publish date" special
  case (currently `github_trending`-only) to also cover `huggingface_models`
  and `video_talks` if their detail pages don't expose a date.
- `lib/ai/model.ts` — swap production embedding provider to Google.
- `components/research-radar/browse-view.tsx` `DIFFICULTIES`/kind filter UI —
  only touch if the existing kind-filter buttons (`showKindFilter`) need to
  list the new kinds too; check `app/page.tsx`'s `showKindFilter` usage first
  since AGENTS.md's UI-must-display-stored-data-only rule still applies here.

## Implementation requirements
- Verify HF Datasets/Models listing and detail page structure via a live fetch
  (WebFetch or a manual `curl`) before writing selectors — do not guess
  Hugging Face's DOM structure from memory.
- Confirm the exact `@ai-sdk/google` embedding API surface (function name,
  dimension parameter) against its current docs/typings before coding — do
  not assume the same call shape as `@ai-sdk/openai`.
- Keep `content_kind` optional/backward-compatible: existing `sources` rows
  with `content_kind IS NULL` must keep resolving to their current kind.

## Security requirements
- No new secrets needed (Google Gemini key already configured for analysis).
- Same admin-secret/RLS rules as existing routes — no changes to auth model.

## Acceptance criteria
- `ItemKind` includes all 6 kinds; `KindIcon` renders a distinct icon per kind.
- A source row with `content_kind = 'dataset'` (once seeded) is scraped,
  validated, and inserted using the same pipeline, dedupe, and validation
  rules as existing sources — no duplicated logic.
- Production embeddings, after the SQL null-out + one `/api/analyze` run,
  are populated via Google's free embedding model (verify via a
  `select count(*) from paper_analyses where embedding is not null;` before/
  after).
- `npm run typecheck` and `npm run lint` pass.

## Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Manual test steps
- After implementation, share the exact HF Datasets/Models/newsletter listing
  URLs you want seeded — I'll insert the `sources` rows and run a manual
  scrape (`POST /api/scrape` with `sourceIds` scoped to the new rows) so you
  can watch dev-server logs confirm candidates/inserts for each new kind.
- Run the embedding SQL null-out, then `POST /api/analyze`, then check
  `paper_analyses.embedding` populates and `/` "Related Research" section
  (which depends on it) starts showing results again.
