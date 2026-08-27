# Indeed-Style Split Browse Layout

## Goal
Replace the current card-grid browsing pages (`/`, `/papers`, `/repos`) with a job-board-style layout modeled on the provided Indeed screenshot: a search bar + filter pill row up top, then a two-column split view — a scrollable compact list of items on the left, and a sticky detail panel on the right that updates as you select a different item, without a full page navigation.

## Visual reference
User-provided screenshot of indeed.com's job search page. Layout elements being adopted:
- Top bar: logo + search input(s) + primary action button, inline.
- Filter pill row directly below the search bar (Pay / Distance / Job type / etc. in Indeed → maps to our existing category/difficulty concepts).
- Left column: narrow, scrollable list of compact result cards; selected card has a visible highlight (colored left border / outline in the screenshot).
- Right column: sticky detail panel with header (title, org, meta line, primary action), then sectioned content below, independently scrollable from the list.

**Deliberate departure from the reference**: Indeed uses a light theme with blue branding. Research Radar is already fully dark-themed (`dark` class on every page, existing `difficulty-*`, `card`, `border` tokens). This task adopts the *layout and interaction pattern* only — search bar, filter pills, split list/detail, sticky panel, selected-state highlight — not Indeed's light color scheme or blue branding. Assumption stated explicitly since the user said "same layout and design" but the rest of the app's visual identity should stay consistent.

## Skills read
- `example-skills:frontend-design` — for adapting a reference layout intentionally rather than pixel-cloning a different brand's visual identity.
- `ui-styling` — shadcn/Tailwind patterns already in use (`cn`, CSS variable tokens in `app/globals.css`).
- AGENTS.md section 5 (UI must only display stored data, no scrape/analyze/mutate from the client) and section 19 (required card/detail fields — summary, difficulty, key takeaways, confidence, disclaimer, methodology).

## Existing code inspected
- `app/page.tsx`, `app/papers/page.tsx`, `app/repos/page.tsx` — each independently calls `getPapersForDisplay()` and renders a `<PaperCard>` grid. All three will move to the new split layout with different item filters (all / papers-only / repos-only).
- `app/papers/[id]/page.tsx` — full detail rendering logic (difficulty meter, key takeaways, methodology, prerequisites, confidence, disclaimer, related-by-category) — this becomes the content of the right-hand detail panel, reused rather than rewritten.
- `lib/supabase/queries/papers.ts` — `getPapersForDisplay()` already returns full `PaperDisplayItem` (`paper` + `analysis` + `source` + `kind`) for every item, meaning **no extra fetch is needed to populate the detail panel** — the full dataset already loaded for the list is enough to render any selected item's detail inline, client-side.
- `lib/papers/toCardData.ts`, `lib/papers/display.ts` — existing mapping/formatting helpers, reused as-is for the compact list rows.
- `components/research-radar/site-header.tsx`, `paper-card.tsx`, `difficulty-badge.tsx`, `difficulty-meter.tsx`, `category-pill.tsx` — existing building blocks; category pills already exist as a filter-pill-shaped component, reused for the new filter row.
- No search functionality exists anywhere today (no search input, no query state) — this is new.

## Decisions / assumptions
1. **Data stays server-fetched, interactivity is client-side.** The page (`app/page.tsx` etc.) stays a server component that calls `getPapersForDisplay()` once and passes the full `PaperDisplayItem[]` into a new client component. Selecting a list item updates local React state (`selectedId`) — no navigation, no re-fetch. This matches "UI must display stored data only" (still just displaying data fetched once) while giving the Indeed-style instant-update panel.
2. **Direct-link URLs are preserved.** `/papers/[id]` keeps working as a real route (for sharing/bookmarking a specific paper) — clicking a list item updates the URL via `router.replace(/papers/${id})` (shallow, no scroll/refetch) so the address bar stays meaningful, but the data driving the panel comes from the already-loaded list, not a fresh server fetch. On direct load of `/papers/[id]`, the same split view renders with that item pre-selected (achieved by having `/papers/[id]/page.tsx` render the same shared client component, passing `initialSelectedId`).
3. **One shared component, three filtered instances.** Build `components/research-radar/browse-view.tsx` (client component) taking `items: PaperDisplayItem[]` and `initialSelectedId?: string`. `/` passes all items, `/papers` passes `kind === "paper"` items, `/repos` passes `kind === "repo"` items, `/papers/[id]` passes all items (so the reader can still browse others from the detail view) with that id pre-selected.
4. **Search bar**: client-side substring filter over `title` (and `neutral_summary` as a secondary match) across the currently-loaded item list — no new API route, no server round-trip, since AGENTS.md forbids client-triggered scraping/analysis but a plain in-memory filter over already-fetched display data isn't a pipeline action. No location field (no geographic concept in this domain) — search bar is single-input, full width where Indeed has two.
5. **Filter pills**: replace Indeed's Pay/Distance/Job type/etc. with domain-relevant filters already representable in stored data: difficulty (`beginner`/`intermediate`/`expert`) and category (distinct `primary_category` values present in the loaded set). Multi-select category, single-select difficulty (or "All"). Pure client-side filtering of the already-loaded array — no new query.
6. **List item density**: compact card (title, source name, difficulty badge, published relative time) — no image thumbnail in the list (matches Indeed's text-dense rows), image reappears only in the detail panel like the current `/papers/[id]` design already does.
7. **Selected-state highlight**: left border accent color (reuse `--accent-indigo` already used elsewhere for links/bullets) on the selected list row, matching the blue-highlight pattern in the screenshot.
8. **Mobile**: below `lg` breakpoint, stack instead of split (list full-width; tapping an item could either push to `/papers/[id]` as a real page nav on mobile, or show the panel below the list — simplest and consistent: on mobile, list item taps navigate to `/papers/[id]` as a normal page (no split view complexity below `lg`), matching the app's existing responsive patterns elsewhere (`sm:`/`lg:` grid breakpoints).
9. **Related Research section**: still rendered inside the detail panel content exactly as today, using the already-loaded `items` array to compute same-category matches client-side instead of the current `getRelatedByCategory()` server call (avoids a second data source now that everything needed is already loaded once).

## Files likely to change
- `components/research-radar/browse-view.tsx` (new, client component) — search input, filter pills, split list/detail, selection state, mobile stacking.
- `components/research-radar/paper-list-row.tsx` (new) — compact left-column row (extracted from `PaperCard`'s content, not its card-grid styling).
- `components/research-radar/paper-detail-panel.tsx` (new) — extracted from the current body of `app/papers/[id]/page.tsx`, parameterized to take a `PaperDisplayItem` and the full `items` list (for related-by-category) instead of doing its own fetch.
- `app/page.tsx`, `app/papers/page.tsx`, `app/repos/page.tsx` — become thin server components: fetch once, filter by kind, render `<BrowseView items={...} />`.
- `app/papers/[id]/page.tsx` — fetch all items server-side, verify the id exists (still 404 via `notFound()` if not among analyzed items), render `<BrowseView items={...} initialSelectedId={id} />`.
- `components/research-radar/site-header.tsx` — unchanged structurally, but visually may need a shorter height to sit above the new search bar row, matching the reference's compact top bar. Minor spacing tweak only.
- `components/research-radar/paper-card.tsx` — kept as-is (still used by "Related Research" mini-cards inside the detail panel, per the current design) unless the panel's related section switches to `paper-list-row` styling instead for consistency — decide during implementation based on which reads better; not a functional risk either way.

## Implementation requirements
- No new Supabase queries — `getPapersForDisplay()` is called once per page load (already true today), all filtering/searching after that is client-side over the in-memory array.
- `"use client"` only on the new interactive components (`browse-view.tsx`); the page files stay server components performing the single data fetch.
- Keep `DifficultyBadge`, `DifficultyMeter`, `CategoryPill` components unchanged — only their usage context changes.
- Preserve all AGENTS.md section 19 required detail-page fields (summary, difficulty score + label, methodology, exactly 3 key takeaways, confidence, disclaimer) in the detail panel.
- Responsive: `lg:` breakpoint for split view; below that, list-only with real navigation to `/papers/[id]`.

## Security requirements
- No new secrets or server actions. Everything here is a read of data already fetched via the existing service-role queries; no client-side Supabase or admin-secret exposure.

## Acceptance criteria
- `/` shows a search bar, filter pills (difficulty + category), and a split list/detail view on desktop widths; selecting a different item in the list updates the detail panel instantly without a full-page reload, and updates the URL to `/papers/<id>`.
- `/papers` and `/repos` show the same layout, pre-filtered to their kind.
- Visiting `/papers/<id>` directly still works and pre-selects that item in the panel.
- An unknown id still 404s via `notFound()`.
- Typing in the search box filters the visible list live; clearing it restores the full list.
- Selecting a difficulty or category pill filters the list; multiple category pills can be active at once (OR), difficulty is single-select ("All" clears it).
- Below the `lg` breakpoint, the page shows a single-column list where tapping an item navigates to `/papers/[id]` as a normal page.
- `npm run typecheck`, `npm run lint`, and `npm run build` all pass.

## Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Manual test steps (after implementation)
1. `npm run dev`, visit `http://localhost:3000/`.
2. Confirm search bar + filter pills render above a split list/detail view (desktop width).
3. Click several different list items — confirm the right panel updates instantly and the URL changes to `/papers/<uuid>` each time.
4. Type a partial title into the search box — confirm the list filters live.
5. Toggle a difficulty pill and a category pill — confirm the list narrows accordingly.
6. Resize the browser below the `lg` breakpoint (or use device toolbar) — confirm it collapses to a single list column, and tapping an item navigates to `/papers/[id]` as a full page.
7. Repeat steps 2–6 on `/papers` and `/repos`, confirming each only shows its respective kind.
8. Visit an invalid id directly, e.g. `/papers/00000000-0000-0000-0000-000000000000` — confirm 404.
