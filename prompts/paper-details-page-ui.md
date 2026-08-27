### Prompt: Paper Details Page UI

#### Goal
Implement the paper/research details page UI, adapted from the attached "biasly" article-detail
reference screenshot, tailored to Research Radar's product (AI-estimated technical difficulty
instead of political bias, key takeaways instead of AI news summary, related research instead of
related stories). UI-only — no data fetching, no Supabase/Clerk/AI-SDK wiring. Uses the same mock
data pattern already used in `app/page.tsx`.

#### Skills read
None — this is a UI-only task using existing shadcn/Tailwind patterns already in the repo
(`components/research-radar/*`, `app/design-system/page.tsx`). No Clerk/Supabase/Oxylabs/AI-SDK
skill applies since no backend/data wiring is involved.

#### Existing code inspected
- `app/page.tsx` — home page, dark-mode shell, header/footer pattern, mock `PaperCardData[]`.
- `components/research-radar/paper-card.tsx`, `difficulty-badge.tsx`, `difficulty-meter.tsx`,
  `category-pill.tsx` — existing design-system pieces to reuse.
- `components/ui/button.tsx`, `components/ui/badge.tsx` — shadcn primitives available.
- `app/globals.css` — design tokens (difficulty colors, spacing scale, shadow tokens, radius scale,
  accent-indigo).
- `app/design-system/page.tsx` — canonical token/component reference.

#### Decisions / assumptions
1. Route: `app/papers/[slug]/page.tsx`. Since Supabase isn't wired yet, the page renders one mock
   `PaperAnalysisData` object regardless of the `slug` param (same "mock data now, swap for a query
   later" approach as `app/page.tsx`).
2. Reuse existing header/footer markup from `app/page.tsx` verbatim (logo, nav, Sign in button) so
   the site shell stays consistent — will extract into a shared `SiteHeader`/`SiteFooter` only if
   asked; for now duplicate inline in the new page to keep the change scoped.
3. Reference page has Save/Share icon buttons, a bias-analysis "How We Analyze Bias" link, a
   newsletter signup band, and per-source bias-breakdown table. These are dropped or replaced —
   they're either bias-specific (not applicable) or unrequested features (newsletter). Kept:
   headline, byline meta, hero image, difficulty distribution box, body copy, sidebar cards,
   related items, footer.
4. Sidebar card 1 ("Bias Analysis" → "AI-Estimated Difficulty"): shows `DifficultyMeter`,
   difficulty score /10, `DifficultyBadge`, confidence %, and the required AI-estimation disclaimer
   (section 19 of AGENTS.md — not objective truth).
5. Sidebar card 2 ("AI Summary" → "Key Takeaways"): exactly 3 bullet points (per schema), generated
   timestamp, "AI takeaways can make mistakes" note — mirrors the reference's disclaimer pattern.
6. Sidebar card 3 ("Source Breakdown" → "Source"): source name, category pills, published date,
   link to original paper (external, `target="_blank"`).
7. "Related Stories" → "Related Research": grid of `PaperCard`s (reusing the existing component)
   instead of the reference's custom thumbnail list, since `PaperCard` already exists and fits.
8. Core methodology is rendered as prose paragraphs under the headline (matches reference body
   layout), representing the "full technical analysis and methodology breakdown" required by
   AGENTS.md section 1.
9. Keeps the same dark theme (`className="dark"` on root) and token usage as the rest of the app.

#### Files likely to change
- `app/papers/[slug]/page.tsx` (new) — the details page.
- `components/research-radar/paper-card.tsx` — wrap title in a `Link` to `/papers/[slug]` so the
  page is reachable from the home grid (minimal wiring, no other behavior change).
- `app/page.tsx` — add a `slug` field to each mock paper so the link has somewhere to go.

No API routes, Supabase queries, or server modules touched.

#### Implementation requirements
- Server component (no `"use client"` needed; only `CategoryPill` internals already use client
  where required).
- Layout: two-column on `lg+` (main content ~2/3, sticky sidebar ~1/3), single column stacked on
  mobile — matches the reference's responsive split.
- Sections top to bottom (main column): breadcrumb (category · source), title, byline (source,
  published date, read time, difficulty badge), hero image (`aspect-video`, rounded, using
  `/paper-placeholder.svg`), a boxed "Technical Difficulty" panel with `DifficultyMeter` directly
  under the image (mirrors the reference's boxed bias-distribution panel), then body paragraphs
  (core methodology).
- Sidebar (sticky on `lg+`, stacked cards): Difficulty card, Key Takeaways card, Source card — each
  a `rounded-2xl border border-border bg-card` panel matching `PaperCard`'s surface treatment.
- Below main content: "Related Research" section, full-width grid of `PaperCard` (reuse existing
  mock papers array, excluding the current one), 3 columns on `lg`, matching home page grid.
- Footer: same as `app/page.tsx`.
- Use existing tokens only (`bg-card`, `border-border`, `text-muted-foreground`,
  `text-accent-indigo`, difficulty tokens, `--shadow-md-token`, `rr-*` spacing where natural) — no
  new colors invented.
- Typography scale matches `design-system/page.tsx` (H1 `text-3xl font-bold` for title, `text-xl
  font-semibold` for section headers, `text-sm`/`text-xs` for meta and body).

#### Security requirements
None — static UI, no secrets, no data fetching, no user input.

#### Acceptance criteria
- `/papers/example-slug` renders without errors, dark theme, responsive at mobile/tablet/desktop.
- Difficulty score, label, confidence, and disclaimer are visibly framed as AI-estimated, not
  objective fact.
- Exactly 3 key takeaways shown.
- Related Research grid reuses `PaperCard` and excludes the current paper.
- Home page paper card titles link to `/papers/[slug]`.
- No new dependencies added.

#### Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build` (routes changed)

#### Manual test steps
1. `npm run dev`
2. Open `http://localhost:3000` — confirm card titles are links.
3. Click a card title (or open `http://localhost:3000/papers/scaling-laws-rat` directly) — confirm
   the details page renders: hero image, difficulty panel, body text, sidebar cards, related
   research grid, footer.
4. Resize the browser to mobile width — confirm the sidebar stacks below the main content and the
   related-research grid collapses to 1 column.
