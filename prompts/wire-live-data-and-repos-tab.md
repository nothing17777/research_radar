# Wire Live Supabase Data + Add Repos Tab

## Goal
Replace the hardcoded mock data on the home page and paper details page with real Supabase queries, and add a "Repos" nav tab that shows GitHub Trending items separately from papers/articles.

## Skills read
- AGENTS.md section 5 (architecture — UI must display stored data only, must not scrape/analyze/mutate), section 19 (cards/details page required fields), section 21 (Supabase joined-table filter gotcha).
- `.agents/skills/supabase/SKILL.md` for query patterns (already used consistently in `lib/supabase/queries/*`).

## Existing code inspected
- `app/page.tsx` — home page renders a hardcoded `MOCK_PAPERS: PaperCardData[]` array via `<PaperCard>`. Static `CATEGORIES` pill list.
- `app/papers/page.tsx`, `app/sources/page.tsx` — both stub pages, "Coming soon."
- `app/papers/[slug]/page.tsx` — hardcoded `const PAPER = {...}` object with a `RELATED_PAPERS` mock array; route param is named `slug` but there is no `slug` column anywhere.
- `components/research-radar/paper-card.tsx` — `PaperCardData` type: `{slug, title, excerpt, imageUrl, categories, difficulty, publishedLabel, readTimeLabel}`. Links to `/papers/${data.slug}`.
- `components/research-radar/site-header.tsx` — `active: "home" | "papers" | "sources"` union; nav has exactly Home/Papers/Sources.
- `components/research-radar/difficulty-badge.tsx`, `difficulty-meter.tsx` — take a `Difficulty = "beginner" | "intermediate" | "expert"` prop, matches `difficulty_label` exactly.
- `lib/supabase/queries/papers.ts` — `getPapersWithAnalysis(limit, offset)` already exists: returns `PaperRow[]` where `analyzed_at is not null`, ordered by `published_at desc`. **It does not join `paper_analyses` or `sources`** — only raw `papers` columns.
- `lib/supabase/queries/sources.ts` — `getActiveSources()`, `getSourceById(id)`.
- `lib/supabase/types.ts` — `papers` has no `slug` column; primary key is `id: string` (uuid). `sources.parser_strategy` is how a GitHub Trending source is identified (`"github_trending"`, seeded in `supabase/schema.sql`).
- `lib/supabase/server.ts` — `createServiceRoleSupabaseClient()` used everywhere; safe for server components since this is a service-role read of publicly-readable tables per the RLS policies in `schema.sql` ("papers/paper_analyses are publicly readable").

## Decisions / assumptions
1. **No `slug` column exists and none is required by AGENTS.md section 7.** Adding one would be a schema change with no functional benefit — the `papers.id` (uuid) works as the route param. Rename the dynamic route from `app/papers/[slug]/page.tsx` to `app/papers/[id]/page.tsx`, and change `PaperCardData.slug` usage to carry the paper's `id`. (Keeping the prop name `slug` on `PaperCardData` would be misleading since it now holds a uuid — rename the field to `id` and update the one place that constructs the link.)
2. **New query needed**: neither existing query joins `papers` + `paper_analyses` + `sources` together, which the card/detail views need (title, image, published date from `papers`; difficulty/summary/takeaways from `paper_analyses`; source name from `sources`). Add `getPapersForDisplay()` in `lib/supabase/queries/papers.ts` (or a new `lib/supabase/queries/display.ts` — using the existing file keeps papers-related queries together) that:
   - Fetches analyzed papers + their `paper_analyses` row + parent `source` (name, parser_strategy) in one round trip using three unfiltered selects (per AGENTS.md section 21's joined-table filter gotcha — never `.eq('paper_analyses.x', ...)`), joined in JS by id.
   - Excludes any paper whose `paper_analyses` row is missing (shouldn't happen since `getPapersWithAnalysis` already filters on `analyzed_at`, but the join must handle it defensively rather than crash).
3. **Repo vs. paper classification**: derive `kind: "paper" | "repo"` per item from `source.parser_strategy === "github_trending"`. No new DB column — this is a pure display-layer derivation, consistent with "UI must display stored data only" (no new mutation, just a read-time classification).
4. **Repos tab**: add `/repos` as a new route (not a query param on `/papers`) to keep it a clean, linkable, bookmarkable URL and match the existing one-page-per-nav-item pattern (`/`, `/papers`, `/sources`). `SiteHeader`'s `active` union gets `"repos"` added.
5. **`/papers` page**: since it's currently a stub, this task also makes it real — showing all analyzed items **excluding** repos (i.e. actual papers/articles), matching the "Repos tab shows repos separately" framing. Home page (`/`) keeps showing everything analyzed (mixed), matching its current "Latest Research" framing — categories/difficulty filtering UI on `/` is out of scope for this task (still static category pills, no working filter logic — that's a separate, larger feature not requested here).
6. **Paper details page** (`app/papers/[id]/page.tsx`): fetch by id using a new `getPaperWithAnalysisById(id)` query (single-row version of the join above); if no analyzed paper matches, render Next.js's `notFound()`. Related Research section: AGENTS.md section 20 (pgvector) isn't implemented yet, so there's no embedding-based similarity to query — for now, show up to 3 other analyzed items sharing the same `primary_category`, ordered by `published_at desc`, excluding the current paper. This is a placeholder until section 20 lands, not a permanent design — noted as such in a code comment.
7. **Card fields mapping** (`PaperCardData`): `excerpt` ← `neutral_summary` (truncated in the component or query, whichever is simpler — do at query/mapping time to avoid re-truncating in multiple render paths), `categories` ← `[primary_category]` (schema only stores one category per paper, not an array, so this becomes a single-element array to fit the existing multi-category-capable prop), `difficulty` ← `difficulty_label`, `publishedLabel`/`readTimeLabel` ← formatted from `published_at` (relative time, e.g. "2h ago") and a naive word-count-based read time estimate from `raw_text` (e.g. `Math.ceil(wordCount / 200)` minutes) since no stored read-time field exists.
8. Image: `imageUrl` ← `papers.image_url ?? "/paper-placeholder.svg"` (matches AGENTS.md section 7's "optional, can fallback to a technical placeholder").

## Files likely to change
- `lib/supabase/queries/papers.ts` — add `getPapersForDisplay()`, `getPaperWithAnalysisById(id)`, and shared mapping types/helpers (relative-time + read-time formatting can live in a small new `lib/papers/display.ts` helper to avoid bloating the query file with presentation logic).
- `components/research-radar/paper-card.tsx` — rename `slug` field to `id` in `PaperCardData` and the `Link href`.
- `components/research-radar/site-header.tsx` — add `"repos"` to the `active` union and a Repos `<Link>`.
- `app/page.tsx` — replace `MOCK_PAPERS` with `getPapersForDisplay()`, map to `PaperCardData`.
- `app/papers/page.tsx` — replace stub with real list (papers/articles only, `kind !== "repo"`).
- `app/repos/page.tsx` (new) — list view for `kind === "repo"` items, reusing `PaperCard`/`SiteHeader`.
- `app/papers/[slug]/page.tsx` → renamed to `app/papers/[id]/page.tsx` — replace hardcoded `PAPER`/`RELATED_PAPERS` with real fetch + related-by-category query; use `notFound()` for a missing/unanalyzed id.

No changes to the scraping/analysis pipeline, Supabase schema, or auth.

## Implementation requirements
- All new queries go through `createServiceRoleSupabaseClient()` in `lib/supabase/queries/*`, matching existing patterns — no direct Supabase calls from page components.
- No `.eq('joinedTable.column', ...)` filters — join in JS per AGENTS.md section 21.
- Pages stay server components (no `"use client"` needed for data fetching — matches the existing static pages, which are already server components by default).
- `notFound()` from `next/navigation` for an unknown/unanalyzed paper id on the details page.
- Keep `DifficultyBadge`/`DifficultyMeter`/`CategoryPill` components unchanged — only the data feeding them changes.

## Security requirements
- No new secrets. Service-role client is already used server-side only, per existing pattern.
- No user input reaches raw SQL — Supabase client parameterizes `.eq()`/`.in()` calls as it already does elsewhere.

## Acceptance criteria
- Home page shows real analyzed papers from Supabase (currently 18), not mock data.
- `/papers` shows analyzed items excluding GitHub Trending repos.
- `/repos` (new) shows only GitHub Trending repos, reachable from a new "Repos" nav item that highlights correctly when active.
- Clicking a card navigates to `/papers/<uuid>` and renders that paper's real title, summary, difficulty, key takeaways, methodology, confidence, and disclaimer.
- An invalid/unknown paper id renders a proper 404 (Next.js `notFound()`), not a crash.
- Nav (Home/Papers/Repos/Sources) works correctly from every page, including paper details (already fixed to use `SiteHeader` in the prior task).
- `npm run typecheck`, `npm run lint`, and `npm run build` all pass.

## Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build` (routes changed/added)

## Manual test steps (after implementation)
1. `npm run dev`.
2. Visit `http://localhost:3000/` — confirm real paper titles/cards appear (not the old mock titles like "Scaling Laws for Retrieval-Augmented Transformers").
3. Visit `/papers` — confirm no GitHub repo items appear there.
4. Visit `/repos` — confirm only the 5 GitHub Trending TypeScript items appear.
5. Click a card — confirm it navigates to `/papers/<uuid>` and shows real analysis content (summary, takeaways, difficulty, methodology).
6. Manually visit `/papers/00000000-0000-0000-0000-000000000000` — confirm a 404 page, not a crash.
7. Click Home/Papers/Repos/Sources from the paper details page — confirm each nav link works.
