# Step 1: Design System & UI Primitives

## Goal
Establish Research Radar's dark-mode design system: CSS tokens in `app/globals.css`, a set of presentational UI primitives, and a visual showcase page at `app/design-system/page.tsx` that renders all of them. This is presentational only — no data fetching, no Supabase, no auth, no scraping/analysis logic.

## Source material
Attached mockup PNG (originally a "Skew News" bias-meter design system) — translated per these rules:
1. **Brand:** "Skew News" → "Research Radar". Keep clean typography, rounded buttons, sleek gray/indigo accents.
2. **Feature pivot:** political bias meters → **Technical Difficulty** meters/badges:
   - Beginner: soft green
   - Intermediate: soft amber/orange
   - Expert: soft rose/crimson
   - Category pills: "LLMs", "NLP", "Computer Vision", "Systems", "Robotics" (replacing "World Cup"/"IPL"/etc.)
3. **Layout:** card spacing, image boundary, and footer layout from the mockup's "CARD EXAMPLE" — difficulty badge on the right of the footer, category chips on the left.

Mockup also specifies: Poppins font family, 4px spacing base unit, 12-column 1280px grid w/ 24px gutter/margin, 3-tier shadow scale, border-radius scale (4/8/12/full).

## Skills read
- None of the 4 approved skills (clerk, supabase, oxylabs-web-scraper, ai-sdk) apply to a presentational design-system task — no auth, DB, scraping, or AI calls are involved. Per AGENTS.md §3, this step correctly uses only Next.js/Tailwind/shadcn patterns from `node_modules/next/dist/docs/` and existing project conventions.

## Existing code inspected
- Repo had **no Next.js project** at session start (no `package.json`, `app/`, or Tailwind config) — only `AGENTS.md`, `CLAUDE.md`, and the skills directories existed.
- Scaffolded via `create-next-app` (TypeScript, App Router, Tailwind v4, ESLint, no `src/`) and initialized `shadcn/ui` (`style: base-nova`, neutral base color, `lucide-react` icons, CSS variables in `app/globals.css`).
- Current `app/globals.css` uses shadcn's OKLCH token system (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--radius`, etc.) with a `.dark` class override block — this is the token layer this task extends, not replaces.
- `components.json` aliases: `@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`.
- `app/layout.tsx` currently uses Geist fonts and "Create Next App" metadata (placeholder, not yet branded).
- `tsconfig.json` strict mode is on; `npm run typecheck` currently passes clean.

## Decisions / assumptions
- **Dark mode is the default/primary aesthetic** per the mockup's "premium dark-mode" request, but we keep shadcn's existing light/dark token pair (both defined) so the app isn't locked to dark-only — `app/design-system/page.tsx` will render with `className="dark"` on its wrapper to showcase the dark aesthetic, matching the mockup.
- Indigo becomes the primary accent color (replacing shadcn's default neutral primary) — added as new `--accent-indigo` tokens layered on top of, not replacing, shadcn's existing `--primary`/`--accent` tokens, to avoid breaking future shadcn component installs.
- Difficulty color tokens (`--difficulty-beginner`, `--difficulty-intermediate`, `--difficulty-expert`, each with a `-bg`/`-fg`/`-border` triplet) are added as new custom tokens, since shadcn has no equivalent.
- Font: Poppins via `next/font/google`, replacing Geist Sans as the primary sans font. Geist Mono is kept for any future code/monospace display needs.
- Spacing/grid/shadow/radius values from the mockup are implemented as Tailwind v4 `@theme` tokens in `globals.css`, not a separate `tailwind.config.ts` (Tailwind v4 is CSS-first; this project has no `tailwind.config.ts` file).
- Components are pure/presentational: props in, JSX out. No client-side state beyond what's needed for hover/focus (handled by CSS, not React state).
- No routing/link behavior beyond the showcase page itself — cards render with plain `<div>`s, not `next/link`, since real navigation is out of scope for Step 1.

## Files likely to change
- `app/globals.css` — add design tokens (indigo accent, difficulty colors, spacing scale, shadow scale, radius scale) as `@theme` extensions; keep existing shadcn tokens intact.
- `app/layout.tsx` — swap Geist Sans → Poppins, update metadata title/description to "Research Radar".
- `components/ui/badge.tsx` (new, via `npx shadcn add badge` if not present, or hand-built to match shadcn conventions) — base badge primitive.
- `components/research-radar/difficulty-badge.tsx` (new) — beginner/intermediate/expert badge variant.
- `components/research-radar/difficulty-meter.tsx` (new) — the 3-segment meter translated from the mockup's bias meter.
- `components/research-radar/category-pill.tsx` (new) — category chip (LLMs, NLP, CV, Systems, Robotics), with optional `+`/add affordance matching mockup style.
- `components/research-radar/paper-card.tsx` (new) — card primitive: image boundary, title, excerpt, footer with category chips (left) + difficulty badge (right), meta row (date/read-time icons).
- `components/ui/button.tsx` — already exists from shadcn init; reuse as-is for Primary/Secondary/Outline/Text/Disabled button states, no changes unless a variant is missing.
- `app/design-system/page.tsx` (new) — showcase page rendering: brand header, color swatches, typography scale, button states, chip examples, difficulty meter + badges (3 variants), spacing scale, example `paper-card.tsx` in context, shadow scale, radius scale.

## Implementation requirements
- All new components live under `components/research-radar/` (domain-specific) vs `components/ui/` (shadcn primitives) — keep this separation per AGENTS.md §21 (small functions, explicit types, no mixed concerns).
- Every component: explicit TypeScript prop types (no `any`), no unused props.
- `DifficultyBadge` and `DifficultyMeter` accept a `difficulty: "beginner" | "intermediate" | "expert"` union prop — reused later by the real paper-details/card components in later steps.
- `CategoryPill` accepts a `label: string` and optional `onAdd?: () => void` (mirrors the mockup's `+` affordance) but Step 1 leaves `onAdd` unwired (decorative only).
- `PaperCard` in the showcase is fed static mock data defined inline in the showcase page (no fetching) — real data wiring happens in a later step per AGENTS.md's UI-must-display-stored-data-only rule (§5).
- Follow Tailwind v4 `@theme` conventions already established by shadcn's block in `globals.css` (`--color-*`, `--radius-*`, `--shadow-*`, `--spacing-*` custom properties, consumed via Tailwind utility classes like `bg-difficulty-beginner-bg`).
- Match mockup card layout precisely: image with rounded corners at top, title (H3 weight), excerpt (body-medium), footer row with category chips left-aligned + difficulty badge right-aligned, meta row below with icon + text pairs (clock/date, bookmark/read-time — reuse via `lucide-react`, already installed by shadcn init).

## Security requirements
- None — purely presentational, no secrets, no network calls, no server actions.

## Acceptance criteria
- `app/design-system/page.tsx` renders at `/design-system` with no runtime errors, showing: brand lockup, color token swatches (including all 3 difficulty tiers), typography scale (H1–H4, body sizes, caption), button states (default/hover/outline/disabled) for at least Primary and Secondary, category pill row, difficulty meter, difficulty badges (all 3 variants), spacing scale swatches, shadow scale swatches, radius scale swatches, and one example `PaperCard`.
- Page visually reads as a **dark, premium aesthetic** with indigo accents, matching the mockup's layout/spacing/typography structure but with Research Radar branding and the beginner/intermediate/expert difficulty system replacing bias meters.
- No `any` types; strict TypeScript passes.
- No unrelated files touched (only files listed above).

## Checks to run
- `npm run typecheck`
- `npm run lint`
- `npm run build` (routes/config changed)

## Manual test steps
1. `npm run dev`
2. Open `http://localhost:3000/design-system` in a browser.
3. Verify: Research Radar branding visible (not "Skew"/"Skew News"), Poppins typography, indigo accent color present, three distinct difficulty color systems (green/amber/rose) rendered in both the meter and badges, category pills read "LLMs / NLP / Computer Vision / Systems / Robotics" (or a similar research-relevant set), card footer has chips on the left and a difficulty badge on the right, no console errors.
4. Resize the browser window to confirm the showcase page is responsive (no horizontal overflow) down to ~375px width.
