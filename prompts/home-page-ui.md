# Step 2: Home Page UI

## Goal
Build `app/page.tsx` as Research Radar's real home page, replacing the `create-next-app` boilerplate, using the design-system primitives already built (`PaperCard`, `CategoryPill`, `DifficultyBadge`/`Meter`, dark theme tokens). Presentational only — no data fetching, Supabase, auth, or scraping wiring yet (matches Step 1's scope; Supabase isn't set up in this repo yet).

## Source material
Attached mockup: "Biasly News" home page — translated per these rules:
1. **Brand:** "Biasly News" → "Research Radar". Drop "Set Location" / "International Edition" / theme toggle switch / date bar — not applicable, keep the header minimal per AGENTS.md's "minimal responsive UI" requirement.
2. **Nav:** top bar with logo left, simple nav links center/right (`Home`, `Papers`, `Sources`), and a `Login` / `Sign in` affordance on the right (Clerk auth UI is out of scope for this step — render a plain `Button` placeholder, unwired).
3. **Category filter row:** the pill row under the header (`World Cup`, `IPL`, ... in mockup) → reuse `CategoryPill` with the existing set (`LLMs`, `NLP`, `Computer Vision`, `Systems`, `Robotics`) plus an "All" pill first. Decorative/unwired (no filtering logic).
4. **Section title:** "Top News" → "Latest Research".
5. **Card grid:** mockup's 3-column grid of 12 cards → 3-column responsive grid (1 col mobile, 2 col tablet, 3 col desktop) of `PaperCard`s using mock data. Drop the per-card bias-percentage bar (`L/Center/Right %`) and "N sources" line — those map to `DifficultyMeter`/`DifficultyBadge` and the confidence/date/read-time row already built into `PaperCard`, not a 1:1 visual port.
6. **Footer:** mockup's 4-column footer (Company/Help/Connect links + social icons) → simplified to one minimal footer: brand name, one-line tagline, copyright — per "minimal responsive UI", not a full sitemap footer (no real pages exist for those links yet).

## Skills read
- None of the 4 approved skills (clerk, supabase, oxylabs-web-scraper, ai-sdk) apply — this is presentational UI with mock data, no auth/DB/scraping/AI calls, consistent with Step 1's reasoning in `prompts/design-system.md`.

## Existing code inspected
- `app/page.tsx` — current `create-next-app` boilerplate, to be fully replaced.
- `app/layout.tsx` — Poppins font, `dark`-independent (no forced class), body is `flex flex-col`.
- `app/globals.css` — light/dark OKLCH tokens both defined; `app/design-system/page.tsx` forces `className="dark"` on its own wrapper rather than at the layout level, so light mode is still the default elsewhere in the app.
- `components/research-radar/paper-card.tsx`, `category-pill.tsx`, `difficulty-badge.tsx`, `difficulty-meter.tsx` — all built in Step 1, reused as-is, no changes.
- `components/ui/button.tsx` — shadcn Button, reused for Login/Sign in placeholder.
- No Supabase client, no `lib/supabase/`, no `.env` files exist yet in this repo — confirms real data wiring is a later step.
- `public/` — no paper placeholder images beyond `/paper-placeholder.svg` referenced by the design-system showcase; reuse it for card images and/or a couple of stock Unsplash-style local placeholders if needed (see below).

## Decisions / assumptions
- Keep the home page in **dark mode by default** for brand consistency with the design-system showcase — wrap the page content in `className="dark"` at the `app/page.tsx` root (same pattern as `app/design-system/page.tsx`), rather than forcing it globally in `layout.tsx` (leaves room for a future light/dark toggle without a layout change).
- Header, category pill row, and footer are built directly in `app/page.tsx` for this step (not extracted into separate components) — a single page is small enough that extracting `Header`/`Footer` components now would be premature per AGENTS.md's "no abstractions for single-use code."
- Mock data: 6 `PaperCardData` items (enough to show a responsive 3-column grid across breakpoints without a huge file), inline `const MOCK_PAPERS` array at the top of `app/page.tsx`, covering a mix of all 3 difficulty levels and varied categories/sources. Titles/excerpts are plausible AI/ML paper and blog post names (e.g. arXiv-style and "OpenAI Blog"/"Google DeepMind Blog"-style), clearly fictional placeholder content, not real paper claims.
- Images: use `/paper-placeholder.svg` (already exists from Step 1) for all mock cards — no new binary assets fetched from the network.
- `PaperCard` is rendered with `next/link`-free plain wrapping for now (matches Step 1 decision) since there's no `/papers/[id]` route yet; wrap each card in a non-interactive `<div>`, not an `<a>`.
- Nav/login/category pills have no client state or routes — everything except `CategoryPill`'s existing internal button (already `"use client"`) stays a server component page.

## Files likely to change
- `app/page.tsx` — full rewrite: header (logo + nav + login button), category pill row, "Latest Research" section with responsive `PaperCard` grid, footer.
- No changes to `components/research-radar/*`, `components/ui/*`, or `app/globals.css` — Step 1's primitives and tokens are sufficient.

## Implementation requirements
- Use `Poppins` font already wired globally via `app/layout.tsx` — no font changes needed.
- Header: logo text "Research Radar" (bold, `text-lg`), inline nav (`Home`, `Papers`, `Sources` — plain unstyled text/links, no active-route logic needed since this is the only route), `Button` (shadcn, `variant="outline"` or default) reading "Sign in" on the right. Sticky/border-bottom optional — keep simple, non-sticky is fine.
- Category row: horizontal scrollable/wrapping row of `CategoryPill`s directly under the header, `flex flex-wrap gap-2`.
- Section heading: `<h1>` or `<h2>` "Latest Research" (`text-2xl font-bold` matching the design-system H2 scale), optionally a one-line subheading e.g. "AI-analyzed papers and technical blog posts, ranked by difficulty."
- Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`, each cell renders one `PaperCard`.
- Footer: `border-t border-border`, brand name + short tagline + `© 2026 Research Radar. All rights reserved.` (use `new Date().getFullYear()` instead of hardcoding 2026).
- Explicit TypeScript types for the mock data array (reuse `PaperCardData` type from `paper-card.tsx`), no `any`.
- Whole page responsive down to ~375px width — no horizontal overflow.

## Security requirements
- None — purely presentational, no secrets, no network calls, no server actions, no forms that submit anywhere.

## Acceptance criteria
- `app/page.tsx` renders at `/` with no runtime errors: header with logo/nav/sign-in button, category pill row, "Latest Research" heading, responsive grid of 6 `PaperCard`s (1/2/3 columns depending on viewport), minimal footer with dynamic copyright year.
- Visually dark, indigo-accented, matches the established design-system aesthetic (not a literal reskin of the light-mode "Biasly News" mockup).
- No `any` types; strict TypeScript passes.
- No unrelated files touched (only `app/page.tsx`).

## Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build` (route content changed)

## Manual test steps
1. `npm run dev`
2. Open `http://localhost:3000/` in a browser.
3. Verify: "Research Radar" branding in header, nav links present, "Sign in" button visible (unwired — clicking does nothing yet), category pills row rendered, "Latest Research" heading, 6 paper cards in a grid showing varied difficulty badges (beginner/intermediate/expert) and categories, footer with current year.
4. Resize the browser window from desktop down to ~375px width — confirm the grid reflows to 1 column, no horizontal scrollbar appears, header/nav don't overlap or clip.
