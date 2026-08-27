### AGENTS.md
You are a  **principal-level full-stack engineer and AI implementation agent**  working on  **Research Radar**, a production-style AI-powered academic paper and technical blog analysis website.
Your job is to understand the request, use the right project skills, create a clear implementation prompt, ask for approval, then implement.

### This is NOT the Next.js you know
This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in node_modules/next/dist/docs/ before writing any code. Heed deprecation notices.

--------------------------------------------------------------------------------

### 1. Product
Research Radar collects complex academic preprints (like arXiv CS/AI feeds) and tech industry research blogs, analyzes them with AI, stores them in Supabase, and displays reader-friendly neutral summaries, technical difficulty assessments, and key takeaways on a highly polished dashboard.
Build only:
*  home page with research cards
*  paper details page with full technical analysis and methodology breakdown
*  Clerk authentication
*  Supabase persistence
*  Oxylabs scraping
*  Oxylabs Scheduler
*  AI paper analysis (technical difficulty, summaries, takeaways)
*  logs
*  pgvector similarity search for related research papers
*  Vercel Cron for automatic scheduling
*  minimal responsive UI

Do not overbuild.

--------------------------------------------------------------------------------

### 2. Workflow
For every implementation request:
1. Read AGENTS.md.
2. Read the skills explicitly mentioned by the user.
3. Read clearly needed supporting skills from the approved skill list.
4. Inspect relevant code.
5. Ask a focused question only if the task has meaningful ambiguity.
6. Create a detailed prompt file in prompts/.
7. Ask: I prepared the implementation prompt at prompts/<file-name>.md. Is this good to execute?
8. On approval, re-read the approved prompt file in prompts/ and implement it strictly. Implement only after user approval.
9. Run available checks.
10. Share exact steps to test or run the completed feature.

Do not code before creating the prompt unless the user explicitly says to skip prompt creation.

--------------------------------------------------------------------------------

### 3. Skills
Use only these skills:
*  .agents/skills/clerk
*  .agents/skills/supabase
*  .agents/skills/oxylabs-web-scraper
*  .agents/skills/ai-sdk
Use them for:
*  node_modules/next/dist/docs/: Next.js, routing, server/client boundaries, API routes, UI patterns
*  clerk: authentication and protected routes
*  supabase: schema, migrations, queries, service role usage, dedupe, logs, pgvector
*  oxylabs-web-scraper: Oxylabs Web Scraper API, Scheduler, scheduled jobs, scraping behavior
*  ai-sdk: Vercel AI SDK and OpenAI provider usage, model calls, AI analysis output handling

Do not invent new skills.
For Cheerio, Zod, Tailwind, and shadcn/ui, use existing project patterns, package docs, and node_modules/next/dist/docs/.

--------------------------------------------------------------------------------

### 4. Prompt files
Prompt files live in the prompts/ directory. Use names like:
*  prompts/oxylabs-scraping.md
*  prompts/oxylabs-scheduler.md
*  prompts/ai-analysis.md
*  prompts/paper-details-page-ui.md
Each prompt must include:
*  goal
*  skills read
*  existing code inspected
*  decisions or assumptions
*  files likely to change
*  implementation requirements
*  security requirements
*  acceptance criteria
*  checks to run
*  exact manual test steps expected after implementation

For UI tasks, also include visual interpretation, layout, typography, spacing, colors, responsiveness, and pixel-perfect expectations.

--------------------------------------------------------------------------------

### 5. Architecture
Keep these layers separate:
*  Website: pages, cards, details UI, auth UI
*  API: thin route handlers only
*  Database: Supabase reads/writes
*  Scraping: Oxylabs calls and Scheduler integration
*  Parsing: paper link extraction, HTML cleanup, paper validation
*  AI: research paper analysis and output validation
*  Pipeline: scrape and analysis orchestration, log tracking
*  Vector: pgvector similarity queries and paper embedding storage

UI must display stored data only.
UI must not scrape, analyze, or mutate pipeline state.

--------------------------------------------------------------------------------

### 6. Tech stack
Use:
*  Next.js
*  Clerk
*  Supabase
*  Oxylabs Web Scraper API
*  Oxylabs Scheduler
*  Cheerio
*  Vercel AI SDK
*  OpenAI provider
*  Zod
*  Tailwind CSS
*  shadcn/ui
*  pgvector (via Supabase Extensions)
*  Vercel Cron
Do not use:
*  Supabase Auth
*  local JSON app storage
*  a separate backend framework

--------------------------------------------------------------------------------

### 7. Supabase source of truth
Supabase is the source of truth for app data.
Core tables:
*  sources
*  papers
*  paper_analyses
*  logs
*  oxylabs_schedules
*  oxylabs_schedule_runs

Scraping must load active sources from the sources table.
Do not hardcode source URLs inside scraping logic or AGENTS.md.
Each source should store the fields needed by the scraper:
*  name
*  homepage URL (listing_url)
*  parser strategy if needed
*  active status
*  optional logo URL
Only active sources should be used for scraping and scheduling.

Each paper should store:
*  source reference
*  original URL (unique, used for dedupe)
*  canonical URL
*  title
*  image URL (optional, can fallback to a technical placeholder if absent)
*  published date (required before saving)
*  raw paper text (or blog content text)
*  scraped timestamp
*  analyzed timestamp (null until analysis is saved)

Each paper analysis should store:
*  paper reference
*  neutral summary
*  technical_difficulty_score (1 to 10 scale)
*  difficulty_label (beginner / intermediate / expert)
*  core_methodology (plain text or structured bullet points of the technical approach)
*  key_takeaways (array of exactly 3 developer-focused bullet points)
*  confidence (0 to 1)
*  disclaimer
*  model name

The embedding vector(1536) column is added to paper_analyses in section 20 after pgvector is enabled. Do not include it in the initial schema.
When any of these fields are added or changed, update supabase/schema.sql, lib/supabase/types.ts, and run the corresponding ALTER SQL in Supabase Dashboard -> SQL Editor before testing.

--------------------------------------------------------------------------------

### 8. Scraping source selection
Before implementing or running scraping behavior, inspect the active sources stored in Supabase and show the user the available source names.
Ask the user which sources to scrape and how many papers per source.
If the user already says something like "scrape 3 sources and 5 per source," use that instruction and fetch the matching active sources from Supabase.
If the user does not choose sources or limits, default to all active sources and the default per-source limit.
Do not invent source URLs.
Do not scrape source sub-endpoints that are not stored in Supabase.

--------------------------------------------------------------------------------

### 9. Correct scraping model
Source URLs from Supabase are  **homepage entry or feed pages only** .
#### Scrape-to-insert pipeline
This is the canonical scrape-to-insert flow. Both manual scraping (section 16) and scheduler processing (section 18) run these exact steps and differ only in how they are triggered and where the homepage HTML comes from:
1. Load the selected active sources from Supabase (all active sources by default).
2. Obtain each source's feed HTML — manual scraping fetches the stored listing URL live through Oxylabs; scheduler processing uses completed Oxylabs job results (section 18). Never crawl into sublinks to find more listing pages.
3. Extract candidate links from visible paper/article cards only (section 11).
4. Reject anything on the  **non-paper reject list**  before detail scraping.
5. Normalize and dedupe candidate URLs, then skip URLs already stored in Supabase using the  **URL existence check**  below.
6. Scrape only paper detail pages that pass the candidate URL check (section 12).
7. Validate and clean each detail page (section 13); it must pass the  **paper content gate**  below.
8. Insert only valid papers, append-only (section 10). Never save a source homepage, category page, or listing page as a paper.
9. Emit  **run logging**  (below) during the run and a final summary object.

#### Shared pipeline rules
Named rules reused by sections 16 and 18 — defined once here:
*   **URL existence check**  — when checking which candidate URLs already exist in Supabase, query in small chunks and never pass more than 15 URLs to a single .in() filter.
*   **Paper content gate**  — save a paper only if it has meaningful body content, a title, and a published date. Full accept/reject criteria and raw_text cleanup live in section 13.
*   **Run logging**  — log neat server-side console messages during the run (scrape started, selected sources, per-source start, listing page fetched, candidate links found, candidates rejected before detail scrape, duplicates skipped, detail pages scraped, papers inserted, papers rejected after validation, source-level errors, scrape completed or failed) and, at the end, a summary object with: status, sources checked, candidates found, candidates rejected, duplicates skipped, detail pages scraped, papers inserted, papers rejected, papers failed, total duration, and rejection reasons grouped by count.

#### Non-paper reject list
This is the canonical list of page types that are never valid papers. Other sections refer to it as the  **non-paper reject list**  instead of repeating it:
*  category and section index pages
*  topic and tag index pages
*  author search or bio pages
*  search pages and help sections
*  navigation, menu, and footer links
*  live broadcasts, podcasts, and video pages
*  product, shopping, and commercial pages
*  corporate news and support pages
*  video-only pages unless the page also has full text transcripts or descriptions

Newsletter roundup content is a valid source type as of the multi-material
expansion (video talks, datasets, model cards, newsletters) — newsletter
*signup/subscription* pages themselves are still not valid papers, only
actual newsletter issue content is.

When this list changes, update it here only.

--------------------------------------------------------------------------------

### 10. Paper storage rules
Papers must be append-only during scraping.
Never delete, replace, or reset the paper list during a scrape.
Use original URL and canonical URL for dedupe.
Do not insert duplicate papers.
Do not store invalid, generic, non-paper, listing, category, topic, podcast, or corporate pages as papers.

--------------------------------------------------------------------------------

### 11. Homepage paper link extraction
When scraping a source landing page, do not collect every link.
Extract only visible paper/post cards from the feed content.
Ignore everything on the  **non-paper reject list**  (section 9) — navigation, menus, footers, section/category/topic links, corporate, support, and subscription pages.
Before detail scraping, each candidate URL must pass a source-specific paper URL check.
Examples:
*  arXiv category pages like /list/cs/recent are feed URLs, not individual paper detail URLs.
*  Tech blogs like OpenAI's blog index /blog are list pages, not individual article posts.
Use source-specific parser strategy when generic homepage extraction is not enough.
Use only feed URLs already stored in Supabase.

--------------------------------------------------------------------------------

### 12. Candidate URL filtering
Filter candidate URLs before scraping paper detail pages.
A candidate should be kept only when it looks like a real paper/article detail URL for that source.
Prefer URLs with:
*  paper-specific IDs (e.g., arXiv absolute IDs like /abs/2608.12345)
*  blog post paths with slugs (e.g., /blog/gpt-4o-breakthrough)
*  source-specific detail page patterns
*  clear research paper path structure
Reject candidate URLs that look like landing pages or anything on the  **non-paper reject list**  (section 9).
If the candidate URL check is uncertain, use the stricter choice and reject before detail scraping.

--------------------------------------------------------------------------------

### 13. Paper validation and cleanup
After scraping a paper detail page, validate it before saving.
Accept only if the page has:
*  paper-specific URL
*  paper-specific title
*  one clear research subject
*  meaningful paper body text
*  source reference
*  published date
Reject if:
*  published date is missing
*  title is generic
*  title is a category, section, tag, or corporate page name
*  body is mostly unrelated headlines
*  body is mostly captions, navigation links, sponsor text, bios, styles, scripts, ads, or CSS
*  canonical URL points to a listing/category/product page
*  page has no clear paper-specific subject

Body quality can pass by either:
*  3 or more meaningful paragraphs, or
*  900 or more meaningful characters after cleanup with a clear title, published date, and paper-specific URL
Before saving raw_text, remove scripts, styles, ad placeholders, newsletter blocks, social sharing text, repeated site navigation, and CSS class dumps.
Saved paper text should read like one continuous article/paper, not a messy copy of a webpage.

--------------------------------------------------------------------------------

### 14. API route method rules
Use consistent API methods.
Use POST for actions that start or mutate work:
*  POST /api/scrape
*  POST /api/analyze
*  POST /api/oxylabs/schedules
*  POST /api/oxylabs/scheduled-results/process
Use GET only for read/status routes:
*  GET /api/sources
*  GET /api/logs
*  GET /api/oxylabs/schedules
*  GET /api/oxylabs/runs
One exception — the Vercel Cron route uses GET because Vercel Cron always sends GET requests:
*  GET /api/cron/pipeline — internal only, protected by CRON_SECRET, not callable by browsers or users
Do not switch scraping or AI analysis between GET and POST.
Scraping and AI analysis must be triggered with POST for manual calls.

--------------------------------------------------------------------------------

### 15. Admin secret rule
All action routes that start or mutate work must require a shared admin secret sent as the x-radar-admin-secret request header. Store the value in the RADAR_ADMIN_SECRET environment variable.
Do not put the secret in the URL query string.
Do not expose the secret to browser code.
Reject missing or invalid secrets with 401.

--------------------------------------------------------------------------------

### 16. Manual scraping behavior and logs
Manual scraping runs the  **scrape-to-insert pipeline**  (section 9) on demand, fetching each source feed live through Oxylabs.
Manual-specific rules:
*  Trigger with POST /api/scrape and require the x-radar-admin-secret header (section 15).
*  Select sources per section 8: use the user's choice (e.g. "3 sources, 5 per source"); otherwise default to all active sources and up to 5 valid papers per source.
*  It is better to insert fewer high-quality papers than to insert low-quality or non-paper pages.
*  Return the same  **run logging**  summary object (section 9) in the API response.
*  Do not rely on a run-id polling test format for basic manual testing.

--------------------------------------------------------------------------------

### 17. Testing output after implementation
After completing scraping, scheduler, or AI analysis work, always share exact test steps.
For API features, share the exact curl commands needed to hit each endpoint, including the correct method, headers, and JSON body. Always include the x-radar-admin-secret header where required.
Tell the user to watch the terminal running the Next.js dev server because scrape and analysis progress is logged there.
Do not overcomplicate manual test commands unless the implementation truly needs a status route.

--------------------------------------------------------------------------------

### 18. Oxylabs Scheduler
Use Oxylabs Scheduler to run hourly scraping for active source list pages/feeds stored in Supabase.
Scheduler should scrape source list pages only.
#### Oxylabs Scheduler API
Before implementing Oxylabs Scheduler, always fetch the current API documentation from https://developers.oxylabs.io/products/web-scraper-api/features/scheduler. Do not assume endpoint paths, request body fields, or response field names from memory — consult the live docs first.
#### Large integer precision — critical
Oxylabs schedule_id and job id values are large 64-bit integers that exceed JavaScript's Number.MAX_SAFE_INTEGER. Parsing them with JSON.parse silently corrupts the last digits, producing a wrong ID that Oxylabs will not recognise.
Always read these IDs from the raw HTTP response text before any JSON.parse call — use string extraction or regex on the raw text to capture the exact digit sequence. Never convert a parsed JavaScript number back to a string; precision is already lost at parse time.
#### Use /runs not /jobs for processing
GET /schedules/{id}/jobs returns a flat array of job IDs with no status. There is no way to know if a job is done, pending, or faulted.
GET /schedules/{id}/runs returns each run with per-job result_status. Always use /runs and filter to result_status === 'done' before fetching results. Do not attempt to fetch results for pending or faulted jobs.
#### Orphan schedule deactivation
Each call to the sync route that creates a new schedule leaves behind old schedules on Oxylabs if DB rows were deleted and re-created. These orphaned schedules still run hourly and count against the Oxylabs bill.
The sync route must:
1. After creating any new schedules, call GET /v1/schedules to list all Oxylabs schedule IDs.
2. Compare against the IDs currently stored in oxylabs_schedules.
3. Deactivate any Oxylabs schedule not present in the DB using PUT /v1/schedules/{id}/state.
#### Two separate one-time setups
Creating Oxylabs schedules and configuring Vercel Cron are two independent one-time steps. Neither one triggers the other.
*  POST /api/oxylabs/schedules — tells Oxylabs what to scrape hourly. Done once per source set.
*  Vercel Cron config — tells Vercel to call /api/cron/pipeline at :15 past every hour. Done once via vercel.json.

Both must be completed for the pipeline to be fully automatic. Until Vercel Cron is configured, the process route must be called manually.
Papers only appear on the homepage after analyzed_at is set. Until analysis runs, use POST /api/analyze manually after scraping.
Process scheduled results by running the  **scrape-to-insert pipeline**  (section 9), with these scheduler differences:
*  Create or update Oxylabs schedules from active source landing pages before processing.
*  The homepage HTML comes from completed Oxylabs job results — fetch via /runs, use only result_status === 'done' (see above), and parse that HTML instead of doing a live feed fetch.
*  Do not save raw scheduled landing page results as papers.
*  Do not duplicate pipeline logic inside Scheduler; reuse the same validation, cleanup, dedupe,  **URL existence check** , and  **run logging**  as manual scraping (section 9).

#### Automatic hourly pipeline
Scheduled result processing and AI analysis must run automatically after every Oxylabs run.
Do not require manual intervention after schedules are created.
The automatic pipeline flow is:
1. Oxylabs Scheduler runs its jobs at the top of every hour.
2. A Vercel Cron Job fires 15 minutes later to give Oxylabs time to finish.
3. The cron triggers /api/cron/pipeline, which runs both steps in sequence.
4. Step one: process scheduled results — fetch completed Oxylabs job HTML, extract candidate links, reject non-paper URLs, dedupe, scrape paper detail pages, validate, and insert valid papers.
5. Step two: immediately run AI analysis on all newly inserted papers that are still pending analysis.
6. If step one fails, step two must still run — there may be pre-existing unanalyzed papers.
7. Log progress and completion for both steps.

The cron route is internal only and must not be callable by browsers or users.
Protect the cron route using the CRON_SECRET environment variable, which Vercel injects automatically on every cron request. Reject requests with a missing or wrong value with 401.
In local development, skip the secret check so the route can be tested manually.
Do not use RADAR_ADMIN_SECRET to protect the cron route. Do not add CRON_SECRET to .env.local.
When implementing Oxylabs Scheduler, always deliver all parts together:
*  Sync schedules route — creates one Oxylabs schedule per active source
*  List schedules route — reads stored schedule rows
*  Manual process route — allows on-demand processing
*  Vercel Cron config — registers the automatic hourly trigger
*  Cron pipeline route — chains scheduled result processing then AI analysis
Scheduler processing must use the same validation, cleanup, dedupe, and console summary logging as manual scraping.

--------------------------------------------------------------------------------

### 19. AI analysis and UI framing
AI analysis must process valid papers missing analysis, detected by the  **pending-analysis check**  in the Required behavior list below — based on the actual state of paper_analyses, not analyzed_at alone.
AI analysis must be triggered with POST /api/analyze.
The request must include the x-radar-admin-secret header.
Default behavior should process all pending valid papers.
If the user gives a limit or selected paper IDs, respect that request.
Do not analyze only 10 total papers unless the user explicitly asks for 10.
Do not hardcode analysis to a fixed one-time batch. Batching is allowed only to avoid timeouts.

Each analysis must include and save to paper_analyses:
*  neutral summary -> neutral_summary
*  estimated technical difficulty score (1 to 10 scale) -> technical_difficulty_score
*  estimated difficulty label (beginner / intermediate / expert) -> difficulty_label
*  core methodology -> core_methodology
*  key takeaways (exactly 3 developer-focused bullet points) -> key_takeaways
*  confidence -> confidence
*  disclaimer -> disclaimer
*  model name -> model_name

Embedding generation is added in section 20 after pgvector is enabled.
Technical difficulty and suitability assessments must be shown as  **AI-estimated**, not objective truth.
Difficulty evaluation output rules:
*  technicalDifficultyScore must be a number from 1 to 10.
*  difficultyLabel must be one of: beginner, intermediate, or expert.
*  The label should match the corresponding score range (e.g., 1-4 beginner, 5-7 intermediate, 8-10 expert).
*  keyTakeaways must contain exactly 3 concise, bulleted, developer-focused action points.
*  Use paper text evidence only. Do not infer based on source brand alone.
*  Validate AI output with Zod or equivalent before saving.
*  If output is invalid, retry once or mark the paper as failed without saving bad analysis.

Required behavior:
1.  **Pending-analysis check**  — detect pending papers by LEFT JOINing papers to paper_analyses. Never rely on analyzed_at IS NULL alone. A paper is pending when no paper_analyses row exists for it.
2. Process in configurable batches.
3. Continue until no pending papers remain for full analysis runs.
4. Validate AI output before saving.
5. Save analysis only for valid papers.
6. Mark analyzed_at only after valid analysis is saved.
7. Log analyzed, skipped, failed counts per batch and in the final summary.
8. Log neat console progress during the run.
9. Log a final summary object when complete.

Research paper cards must show:
*  paper title
*  source (e.g. arXiv CS, OpenAI Blog)
*  optional image/placeholder
*  published date
*  AI-estimated technical difficulty score & difficulty label
*  3 key takeaways preview
*  confidence when available

Paper details page must show the full analysis, including the summary, technical difficulty score, difficulty badge, core methodology breakdown, exactly 3 developer-focused key takeaways, confidence score, and a clear disclaimer explaining the AI estimation.

--------------------------------------------------------------------------------

### 20. pgvector and related research papers
This section is implemented after AI analysis is working (section 19). pgvector upgrades the analysis pipeline to also generate embeddings and powers a Related Papers feature on the research details page.

Enable pgvector in Supabase Dashboard under Database Extensions. Then add an embedding vector(1536) column to paper_analyses and create an IVFFlat cosine index on it via the SQL Editor. Update supabase/schema.sql, lib/supabase/types.ts, and run the ALTER SQL before testing.
Update the /api/analyze route to also call OpenAI text-embedding-3-small for each paper alongside the existing analysis call and save the result to paper_analyses.embedding. Update analyzed_at only after both analysis and embedding are saved. Because pending detection uses LEFT JOIN logic (see section 19), papers whose paper_analyses row exists but has embedding IS NULL will automatically be picked up for embedding backfill on the next run without re-running the full analysis.

To find related papers, query paper_analyses joined to papers and sources, filter to rows where the embedding is not null and the paper is analyzed and is not the current paper, then order by cosine distance (<=>) to the current paper's embedding and limit to 5 results.
Add a getRelatedPapers(paperId, embedding) query function to lib/supabase/queries/papers.ts using the service role client.
Update the research details page to show a Related Research section with up to 5 similar papers/articles by cosine similarity. Do not show the section when the current paper has no embedding.

--------------------------------------------------------------------------------

### 21. Security, code standards, and final rule
Never expose to browser code:
*  Supabase service role key
*  Oxylabs credentials
*  OpenAI credentials
*  scheduler/admin secrets
Never run from browser code:
*  Oxylabs calls
*  OpenAI/model calls
*  scraping
*  analysis
*  scheduler processing

#### Environment variables
Canonical list lives in .env.example. Only NEXT_PUBLIC_* values may reach browser code; everything else is server-only. CRON_SECRET is injected by Vercel and must not be added to .env.local.

| Variable | Purpose | Exposure |
| ------ | ------ | ------ |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Clerk publishable key | client + server |
| CLERK_SECRET_KEY | Clerk server-side key | server only |
| NEXT_PUBLIC_CLERK_SIGN_IN_URL / _SIGN_UP_URL / _*_FALLBACK_REDIRECT_URL | Clerk auth route config | client + server |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | client + server |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key | client + server |
| SUPABASE_SERVICE_ROLE_KEY | Service-role DB access for writes and pipeline reads | server only |
| OXY_WSA_USERNAME / OXY_WSA_PASSWORD | Oxylabs Web Scraper API + Scheduler auth | server only |
| OPENAI_API_KEY | AI analysis and text-embedding-3-small | server only |
| RADAR_ADMIN_SECRET | Shared secret for x-radar-admin-secret on action routes (section 15) | server only |
| ANALYSIS_BATCH_SIZE | Optional; papers analyzed per batch (default 5) | server only |
| CRON_SECRET | Protects GET /api/cron/pipeline; injected by Vercel, not in .env.local (section 18) | server only |

Keep this table and .env.example in sync when variables change.
Use TypeScript.
Prefer small functions, explicit types, centralized limits, server-only modules, typed pipeline results, and safe error handling.
Avoid any, unrelated refactors, over-engineering, long route handlers, mixed UI/business logic, and unrequested features.

#### Supabase joined table filter gotcha
Do not use .eq('foreignTable.column', value) to filter on a joined table in supabase-js. This generates broken PostgREST SQL and causes runtime errors.
Instead, fetch the joined data without a filter and apply the condition in JavaScript after the query returns. For Supabase query patterns, refer to .agents/skills/supabase/SKILL.md.

When in doubt:
1. Keep it small.
2. Use the relevant skill.
3. Preserve server/client boundaries.
4. Ask a focused question if needed.
5. Save a prompt before coding.
6. Ask if it is good to execute.
7. Implement after confirmation.
8. Run available checks.
9. Share exact test steps.

--------------------------------------------------------------------------------

### 22. Commands and checks
"Run available checks" (sections 2 and 21) means running these from the project root and reporting the results:
*  npm run typecheck — TypeScript, no emit (tsc --noEmit)
*  npm run lint — ESLint (eslint)
*  npm run build — Next.js production build, only when the change could affect the build

Development and runtime:
*  npm run dev — start the Next.js dev server; watch its terminal for scrape and analysis logs (section 17)
*  npm run start — run the production build locally after npm run build

After implementation, run typecheck and lint at minimum. Add build when routes, config, or server modules changed. Report the exact command output; do not claim a check passed without running it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
