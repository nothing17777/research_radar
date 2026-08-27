# Scout: RAG chat app (new sibling repo)

## Goal
Create a new, separately deployable app called **Scout** — a chat-only
interface where a user describes a project idea and gets back relevant
papers/repos/datasets/models/newsletters retrieved by embedding similarity
from the same Supabase database this app already populates. Retrieval does
the heavy lifting (vector search); the LLM only synthesizes a short answer
over already-retrieved context, keeping generation cheap enough for a
free-tier model.

## Skills read
- .agents/skills/ai-sdk (SKILL.md) — `useChat`, `streamText`, tool/message
  shapes for the installed `ai` v7 + `@ai-sdk/google` v4 versions.
- .agents/skills/supabase (SKILL.md) — read-only client usage, RPC calls.
- .agents/skills/shadcn (SKILL.md) — component patterns, since Scout reuses
  this repo's existing shadcn primitives rather than a foreign UI kit.

## Existing code inspected
- `lib/supabase/queries/papers.ts` `getRelatedPapers` + the
  `match_related_papers` SQL function (`supabase/schema.sql`) — existing
  pattern for embedding-based lookup via an RPC (supabase-js can't order by a
  raw `<=>` expression). Scout needs a variant that takes an arbitrary query
  embedding with no "exclude this paper" filter and no kind restriction.
- `lib/ai/model.ts`, `lib/ai/embedPaper.ts` — embedding model selection and
  1536-dim zero-pad logic. Scout's query-time embedding must call the exact
  same model configuration this app uses to write `paper_analyses.embedding`
  (see `prompts/new-material-sources.md` — production moves to Google's free
  embedding model as part of that work; Scout depends on that landing first
  so query and corpus vectors are comparable).
- `lib/supabase/server.ts` — `createServiceRoleSupabaseClient()` pattern for
  server-only Supabase access; Scout is read-only so it only needs this, no
  write helpers.
- `components/ui/*` (badge, button, card, dialog, input, input-group,
  popover, separator, textarea) — existing shadcn primitives to carry over
  and build the chat UI from, per the user's decision to reuse one real
  component base rather than build from scratch or integrate multiple
  incompatible OSS codebases.
- `app/layout.tsx`, Clerk setup (`@clerk/nextjs` v7) — auth pattern to keep;
  Scout keeps sign-in (same Clerk app or a new one — see open question below).
- `.env.local` (already reviewed this session) — Scout needs the read-side
  Supabase vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) and the Gemini key, copied into its own
  `.env.local` — never hardcoded into source, never printed/logged during
  setup.

## Decisions / assumptions
- **New sibling directory**: `git clone` this repo into
  `/Volumes/T7 Shield/ai eng/scout/` (sibling to `research-radar/`, per "new
  directory from this parent folder"). This preserves git history in the new
  repo as its own independent history at clone time; it is not a subtree/
  submodule of the original.
- **App name**: "Scout" everywhere a name is user-visible (page title, header,
  `package.json` name, README) and in the new repo's own `AGENTS.md`/
  `CLAUDE.md` (rewritten to describe Scout's actual scope — chat only, no
  scraping — not copied verbatim from the original, since the original's
  AGENTS.md describes a product Scout no longer builds).
- **Stripped from the clone**: `/`, `/papers`, `/papers/[id]`, `/repos` pages
  and their browse components (`browse-view.tsx`, `paper-card.tsx`,
  `paper-list-row.tsx`, `paper-detail-panel.tsx`, `category-combobox.tsx`,
  `category-pill.tsx`, `difficulty-badge.tsx`, `difficulty-meter.tsx`,
  `landing-*`, `ripple-canvas.tsx`); `/api/scrape`, `/api/analyze`,
  `/api/oxylabs/*`, `/api/cron/pipeline`, `/logs`, `/api/logs`, and everything
  under `lib/scraping/`, `lib/ai/analyzePaper.ts`, `lib/ai/pipeline.ts`,
  `lib/ai/embedPaper.ts` (Scout never writes papers or runs analysis).
  `vercel.json`'s cron entry is removed (Scout has no cron job).
- **Kept from the clone**: Clerk auth, `lib/supabase/server.ts`, `lib/utils.ts`,
  design tokens in `app/globals.css`, `components/ui/*`, `lib/ai/model.ts`
  (trimmed to just the embedding + a chat generation model getter — analysis
  model/schema code removed).
- **Retrieval RPC**: new `match_papers_by_query(query_embedding vector(1536),
  match_count int)` SQL function — same shape as `match_related_papers` minus
  the `match_paper_id` exclusion, added to the ORIGINAL app's
  `supabase/schema.sql` (schema lives with the app that owns the database
  writes) and run once via Supabase SQL editor; Scout's query code just calls
  the RPC by name, same as `getRelatedPapers` does today.
- **Chat flow (retrieval-heavy, generation-light)**: on each user message,
  Scout's `/api/chat` route (1) embeds the message text with the same
  embedding model/config as the corpus, (2) calls `match_papers_by_query` for
  top ~8 candidates, (3) fetches those rows joined with `paper_analyses` +
  `sources` (reuse the join-in-JS pattern from `getPapersForDisplay`), (4)
  builds a compact context block (title, kind, difficulty, 1-2 sentence
  summary per candidate — not full `raw_text`, to keep the prompt small) and
  (5) calls `streamText` with Gemini Flash to produce a short recommendation
  referencing the candidates by title. The retrieved items are also returned
  alongside the stream (e.g. as a data/annotation payload `useChat` can read)
  so the UI can render them as compact result cards under the assistant's
  message — no second LLM call needed to "look up" citations.
- **No message persistence**: chat history lives in the client via `useChat`'s
  in-memory state for the session; nothing is written to Supabase. Simplest
  option, zero new tables, matches "keep everything free" (no extra storage
  growth from chat transcripts). Revisit only if the user later wants saved
  conversations.
- **Theme switcher**: a `ThemeVariant` type with ~10 presets (chatgpt, claude,
  gemini, deepseek, grok, perplexity, copilot, lechat, metaai, poe), each a
  set of CSS custom-property overrides (accent color, bubble radius, font
  pairing) layered on the existing `app/globals.css` token system — same
  component tree, swappable `data-theme` attribute, persisted in
  `localStorage`. No new component library per theme.

## Open questions to confirm before implementation
- **Clerk**: reuse the exact same Clerk application (same publishable/secret
  keys, same user base) so a signed-in user sees both apps as one account, or
  create a separate Clerk application for Scout? Recommend reusing the same
  Clerk app — same audience, no reason to split accounts.
- **Domain/deployment**: Scout will need its own Vercel project once you're
  ready to deploy it (separate from the original's deployment) — no action
  needed until you ask for that step.

## Files likely to change (new repo, after clone)
- `package.json` — rename to `scout`, remove `cheerio`/Oxylabs-only deps if
  nothing else uses them after scraping code is stripped (check before
  removing).
- `app/page.tsx` — replaced with the chat page (redirect `/` straight to chat
  for signed-in users; keep a trimmed landing page for signed-out users reusing
  existing Clerk sign-in patterns).
- `app/api/chat/route.ts` (new) — the retrieval + generation flow above.
- `lib/rag/embedQuery.ts` (new) — shared embed-the-query-text helper.
- `lib/rag/retrieve.ts` (new) — calls the RPC + joins rows, returns compact
  candidate objects.
- `lib/supabase/queries/papers.ts` — trimmed to read-only functions Scout
  actually needs (drop insert/update helpers).
- `components/scout/chat-*.tsx` (new) — message list, composer, result card,
  theme switcher, built on `components/ui/*`.
- `app/globals.css` — add the 10 theme token blocks.
- `AGENTS.md` / `CLAUDE.md` (new repo) — rewritten for Scout's actual scope.
- Delete: files listed under "Stripped from the clone" above.

## Implementation requirements
- Confirm the exact `ai` v7 / `@ai-sdk/google` v4 API for `streamText` +
  `useChat` message/data-part shapes against their current docs before
  wiring the route — do not assume the same shapes as an older `ai` major
  version.
- Retrieval must run before generation on every turn (no tool-calling loop
  where the model decides whether to search) — this is what keeps the
  generation step cheap and predictable per the user's requirement.
- Context sent to the LLM per turn must stay compact (summaries, not raw
  text) to keep token usage low on a free-tier model.

## Security requirements
- Scout is read-only against Supabase: only ever use `select`/RPC calls, no
  service-role writes anywhere in the new repo.
- Same "no secrets in client code" rule as the original app — chat route is
  server-only.
- Clerk-gate the chat page/route the same way the original app gates its
  authenticated pages.

## Acceptance criteria
- Describing a project idea in Scout's chat returns a short synthesized
  answer plus a set of retrieved cards spanning whatever kinds actually
  match (not restricted to only papers or only repos).
- No scrape/analyze/cron code exists in the new repo.
- Switching the theme picker visibly changes the chat's look without a page
  reload and persists across a refresh.
- `npm run typecheck`, `npm run lint`, and `npm run build` all pass in the
  new repo.

## Checks to run (in the new repo)
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Manual test steps
- `git clone` confirmation: `ls "/Volumes/T7 Shield/ai eng/scout"` shows a
  working tree with its own `.git`.
- `npm run dev` in the new repo, sign in, type a project idea (e.g. "I want to
  fine-tune a small LLM for code review comments") and confirm the response
  cites real retrieved items with correct titles/links.
- Switch through several themes in the picker and confirm the look changes
  and survives a page refresh.
