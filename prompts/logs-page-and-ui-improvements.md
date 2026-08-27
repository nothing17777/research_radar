# Logs page + UI polish pass

## Goal
Add the missing pipeline logs view (AGENTS.md §7/§14 require a `logs` table and
`GET /api/logs`, neither of which have a UI or route yet) and fix the four
concrete UI gaps found in a codebase audit: no mobile nav, no confidence shown
on paper cards, magic-number scroll height in browse-view, and duplicated
difficulty-badge wiring.

## Skills read
- .agents/skills/supabase (SKILL.md) — query patterns, service-role usage for an
  internal/admin-only read route.
- .agents/skills/shadcn / ui-styling conventions already used in the repo
  (Button `render` prop pattern, Card, existing Tailwind tokens in
  `app/globals.css`) — no new skill needed beyond matching existing patterns.

## Existing code inspected
- `lib/supabase/queries/logs.ts` — `getRecentLogs(limit = 100)` already exists,
  service-role client, orders by `created_at desc`.
- `lib/supabase/types.ts` — `LogRow { id, level, message, context, created_at }`,
  `LogLevel = "info" | "warn" | "error"`.
- `app/api/scrape/route.ts`, `app/api/analyze/route.ts` — GET-route-with-admin-
  secret is not yet demonstrated anywhere (only POST action routes exist so far);
  will follow AGENTS.md §14/§15 (GET for read routes, still gated by
  `x-radar-admin-secret` since this exposes internal pipeline detail, not public
  dashboard data).
- `components/research-radar/site-header.tsx` — nav is `hidden sm:flex` with no
  fallback for small screens; three `Button render={<Link>}` items plus
  ThemeToggle/Clerk controls on the right.
- `components/research-radar/paper-card.tsx` — `PaperCardData` type has no
  `confidence` field; component renders `DifficultyBadge` but not confidence.
- `lib/papers/toCardData.ts` — builds `PaperCardData` from a `PaperDisplayItem`;
  needs a `confidence` field added here too.
- `components/research-radar/browse-view.tsx` — uses `max-h-[calc(100vh-260px)]`
  for the scrollable list container tied to header height.
- `components/ui/dialog.tsx`, `components/ui/popover.tsx` — existing primitives
  available for a mobile nav sheet/drawer if needed.

## Decisions / assumptions
- Logs page is an internal/admin view, not part of the public dashboard nav (no
  entry in the public sign-in-optional header) — it will live at `/logs` but the
  page itself checks for a signed-in Clerk user (reuse existing Clerk `auth()`
  server helper pattern) and calls `getRecentLogs` directly as a server
  component (no client fetch, no new API route needed for the page itself,
  since Section 14's `GET /api/logs` is a separate concern for potential future
  polling/tooling — added anyway per AGENTS.md §7/§14 as a thin read route since
  it's explicitly named there).
- Mobile nav: reuse `components/ui/dialog.tsx` (or existing `Popover` if the
  Dialog is only used for full modals) as a slide-out sheet triggered by a
  hamburger button, showing the same three links, visible only `sm:hidden`.
- Confidence on cards: display next to `DifficultyBadge` as compact "Xx%"
  text, only when `analysis.confidence` is present (it always is per schema,
  but keep the pattern consistent with the "confidence when available" wording
  in AGENTS.md §19).
- `browse-view.tsx` scroll height: replace the magic number with a CSS approach
  that doesn't hardcode header pixel height — e.g. `h-full` inside a flex
  parent that itself accounts for the sticky header via `flex-1 min-h-0`,
  matching how the rest of the layout already uses flex.

## Files likely to change
- `app/logs/page.tsx` (new) — server component, table/list of recent logs
  (level badge, message, timestamp, expandable context JSON), auth-gated.
- `app/api/logs/route.ts` (new) — `GET`, `x-radar-admin-secret` header required,
  returns `getRecentLogs(limit)` with an optional `?limit=` query param.
- `components/research-radar/site-header.tsx` — add mobile hamburger + drawer.
- `components/research-radar/paper-card.tsx` — add confidence display.
- `lib/papers/toCardData.ts` — pass through `confidence`.
- `components/research-radar/browse-view.tsx` — replace magic-number scroll
  height with a flex-based layout fix.

## Implementation requirements
- Do not add a public nav link to `/logs` in `site-header.tsx` — it's an
  internal page, not part of the product surface described in AGENTS.md §1.
- Logs page must not run any scrape/analyze/scheduler pipeline code — read-only,
  per AGENTS.md §5 (UI must not mutate pipeline state).
- Keep the mobile nav visually consistent with existing header styling (same
  Button variants, spacing, border tokens) — no new color/spacing tokens.
- Confidence text should not visually compete with the difficulty badge — small,
  muted, and secondary.

## Security requirements
- `GET /api/logs` requires `x-radar-admin-secret`, 401 on missing/invalid,
  matching every other action/internal route.
- `app/logs/page.tsx` requires a signed-in Clerk session (redirect or show a
  sign-in prompt otherwise) since it's an internal operational view, not public
  dashboard data.
- No secrets in client bundles; the page fetches data server-side only.

## Acceptance criteria
- `/logs` renders the most recent log rows with level, message, timestamp, and
  can show `context` (e.g. `<pre>` or collapsible) for objects like the run
  summaries already logged by scrape/analyze pipelines.
- `GET /api/logs` returns 401 without the admin secret and the log array with it.
- Site header shows a working hamburger menu with Home/Papers/Repos links below
  `sm` breakpoint; existing desktop nav unchanged.
- Paper cards show confidence (e.g. "82% confidence") next to the difficulty
  badge.
- `browse-view.tsx` list scroll area no longer depends on a hardcoded `260px`
  offset.
- `npm run typecheck` and `npm run lint` pass.

## Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build` (new route + page added)

## Manual test steps
- Run scrape/analyze at least once so `logs` has rows, then visit
  `http://localhost:3000/logs` while signed in — confirm rows render newest
  first.
- `curl http://localhost:3000/api/logs -H "x-radar-admin-secret: $RADAR_ADMIN_SECRET"`
  → JSON array of recent logs. Omit the header → 401.
- Resize the browser (or use dev tools device mode) below `640px` on any page
  with `SiteHeader` — confirm the hamburger appears and opens a working nav
  drawer with Home/Papers/Repos.
- On the home/papers browse view, confirm each card shows a confidence
  percentage and that the list panel scrolls correctly at different window
  heights (resize the window and check the list doesn't get clipped or leave a
  large empty gap).
