# Clerk Authentication

## Goal
Add Clerk authentication to Research Radar (Next.js App Router, v16.3.3): sign-in/sign-up, session-aware header (UserButton), and route protection so the app requires a signed-in user, per AGENTS.md section 1.

## Skills read
- `.agents/skills/clerk/SKILL.md` (router)
- `.claude/skills/clerk-setup` (Next.js quickstart + provisioning)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — this Next.js version (16.3.3) has renamed `middleware.ts` to `proxy.ts`; `middleware` file convention is deprecated.

## Existing code inspected
- `package.json` — Next 16.3.3, React 19.2.8, no Clerk package installed yet.
- `app/layout.tsx` — root layout, `<html><body>` structure, fonts, no providers yet.
- `app/page.tsx` — homepage using mock `PaperCard` data (client of `components/research-radar/*`).
- `app/papers/[slug]/page.tsx` — paper detail page.
- `.env.local` — already contains `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (dev keys), so no `clerk init`/CLI provisioning is needed.
- `components.json` — shadcn/ui present (style `base-nova`, baseColor `neutral`), so the Clerk shadcn theme should be applied for visual consistency.
- No existing auth library in `package.json` — fresh install, no migration needed.

## Decisions / assumptions
1. **File name is `proxy.ts`, not `middleware.ts`** — required by this Next.js version. `clerkMiddleware` from `@clerk/nextjs/server` is exported as `export const proxy = clerkMiddleware(...)`.
2. **Whole app requires sign-in** except Clerk's own `/sign-in` and `/sign-up` routes — this is a minimal internal-style dashboard per AGENTS.md section 1, and no public/private split is specified. `proxy.ts` will treat `/sign-in(.*)` and `/sign-up(.*)` as public and protect everything else with `auth.protect()`.
3. Use Clerk's hosted sign-in/sign-up pages at `/sign-in` and `/sign-up` (catch-all routes) rather than fully custom UI — simplest option satisfying "Clerk authentication" from AGENTS.md section 1; no custom-flow requirement was stated.
4. Apply the shadcn appearance theme (`@clerk/ui` → `shadcn` theme) since `components.json` shows shadcn/ui is used, per the clerk-setup skill's "Common Pitfalls"/shadcn guidance.
5. Add a minimal header in `app/layout.tsx` with Clerk's `<SignedIn>/<UserButton>` and `<SignedOut>/<SignInButton>` so there's a visible way to sign in/out — AGENTS.md doesn't specify a header design, this is the minimal viable placement.
6. `.env.local` keys are reused as-is; no new Clerk app is provisioned.

## Files likely to change
- `package.json` / `package-lock.json` — add `@clerk/nextjs`, `@clerk/ui`.
- `proxy.ts` (new, project root) — `clerkMiddleware` + route protection + matcher.
- `app/layout.tsx` — wrap children in `<ClerkProvider>` (inside `<body>`), add shadcn appearance theme, add minimal header with auth controls.
- `app/globals.css` — import `@clerk/ui/themes/shadcn.css`.
- `app/sign-in/[[...sign-in]]/page.tsx` (new) — renders `<SignIn />`.
- `app/sign-up/[[...sign-up]]/page.tsx` (new) — renders `<SignUp />`.
- `.env.example` (new) — document `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` per AGENTS.md section 21 env table (do not put real values in it).

## Implementation requirements
- Use `@clerk/nextjs` (current SDK, matches Next 16 / React 19).
- `proxy.ts` at project root using `clerkMiddleware` and `createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])`; protect all other routes with `auth.protect()`.
- Matcher config excludes `_next` internals and static files but includes API routes, per the clerk-setup pitfalls table.
- `ClerkProvider` inside `<body>`, not wrapping `<html>` (current SDK requirement).
- No secret key or Clerk server code in client components.
- Keep the header addition minimal — don't restyle the rest of the page.

## Security requirements
- `CLERK_SECRET_KEY` stays server-only (already true in `.env.local`; never referenced from client components).
- No admin-secret or Oxylabs/OpenAI concerns here — out of scope for this change.

## Acceptance criteria
- Visiting any app route while signed out redirects to `/sign-in`.
- Successful sign-in redirects back to the originally requested page.
- Signed-in users see a `UserButton` in the header and can sign out.
- `npm run typecheck` and `npm run lint` pass.

## Checks to run
- `npm run typecheck`
- `npm run lint`

## Manual test steps
1. `npm run dev`
2. Visit `http://localhost:3000/` — expect redirect to `/sign-in`.
3. Sign up or sign in with a test account (Clerk dev instance, keys already in `.env.local`).
4. Confirm redirect back to `/` and that the homepage renders with a `UserButton` visible in the header.
5. Click the `UserButton` → Sign out → confirm redirect back to `/sign-in`.
6. Visit `/papers/scaling-laws-rat` while signed out — expect redirect to `/sign-in` as well.
