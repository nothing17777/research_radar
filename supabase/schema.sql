-- Research Radar database schema
-- Source of truth per AGENTS.md section 7. Update this file + lib/supabase/types.ts
-- together whenever fields change, and run the corresponding SQL against the project.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  listing_url text not null unique,
  parser_strategy text,
  is_active boolean not null default true,
  logo_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- papers
-- ---------------------------------------------------------------------------
create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id),
  original_url text not null unique,
  canonical_url text,
  title text not null,
  image_url text,
  published_at timestamptz not null,
  raw_text text not null,
  scraped_at timestamptz not null default now(),
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists papers_source_id_idx on public.papers(source_id);
create index if not exists papers_analyzed_at_idx on public.papers(analyzed_at);

-- ---------------------------------------------------------------------------
-- paper_analyses
-- ---------------------------------------------------------------------------
create table if not exists public.paper_analyses (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null unique references public.papers(id),
  neutral_summary text not null,
  technical_difficulty_score smallint not null
    check (technical_difficulty_score between 1 and 10),
  difficulty_label text not null
    check (difficulty_label in ('beginner', 'intermediate', 'expert')),
  core_methodology text not null,
  key_takeaways text[] not null
    check (array_length(key_takeaways, 1) = 3),
  confidence numeric not null
    check (confidence between 0 and 1),
  disclaimer text not null,
  model_name text not null,
  primary_category text not null,
  prerequisites text[],
  created_at timestamptz not null default now()
);

create index if not exists paper_analyses_paper_id_idx on public.paper_analyses(paper_id);

-- Migration: run this manually in Supabase Dashboard -> SQL Editor if
-- paper_analyses already exists without these columns.
alter table public.paper_analyses add column if not exists primary_category text not null default '';
alter table public.paper_analyses alter column primary_category drop default;
alter table public.paper_analyses add column if not exists prerequisites text[];
alter table public.paper_analyses add column if not exists embedding vector(1536);

create index if not exists paper_analyses_embedding_idx
  on public.paper_analyses using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Related-papers lookup: supabase-js can't order by a raw `<=>` expression, so
-- this is exposed as an RPC (see AGENTS.md section 21 joined-table filter gotcha).
create or replace function public.match_related_papers(
  query_embedding vector(1536),
  match_paper_id uuid,
  match_count int
)
returns table (paper_id uuid, distance float)
language sql
stable
as $$
  select paper_id, embedding <=> query_embedding as distance
  from public.paper_analyses
  where embedding is not null
    and paper_id <> match_paper_id
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- logs
-- ---------------------------------------------------------------------------
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('info', 'warn', 'error')),
  message text not null,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists logs_created_at_idx on public.logs(created_at desc);

-- ---------------------------------------------------------------------------
-- oxylabs_schedules
-- ---------------------------------------------------------------------------
create table if not exists public.oxylabs_schedules (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references public.sources(id),
  oxylabs_schedule_id text not null,
  cron_expression text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- oxylabs_schedule_runs
-- ---------------------------------------------------------------------------
create table if not exists public.oxylabs_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.oxylabs_schedules(id),
  oxylabs_run_id text not null,
  oxylabs_job_id text,
  result_status text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oxylabs_schedule_runs_schedule_id_idx
  on public.oxylabs_schedule_runs(schedule_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.sources enable row level security;
alter table public.papers enable row level security;
alter table public.paper_analyses enable row level security;
alter table public.logs enable row level security;
alter table public.oxylabs_schedules enable row level security;
alter table public.oxylabs_schedule_runs enable row level security;

-- Public dashboard data: readable by anon + authenticated, no row ownership.
drop policy if exists "sources are publicly readable" on public.sources;
create policy "sources are publicly readable"
  on public.sources for select
  to anon, authenticated
  using (true);

drop policy if exists "papers are publicly readable" on public.papers;
create policy "papers are publicly readable"
  on public.papers for select
  to anon, authenticated
  using (true);

drop policy if exists "paper_analyses are publicly readable" on public.paper_analyses;
create policy "paper_analyses are publicly readable"
  on public.paper_analyses for select
  to anon, authenticated
  using (true);

-- logs, oxylabs_schedules, oxylabs_schedule_runs: internal pipeline tables.
-- No anon/authenticated policies — only the service role (which bypasses RLS)
-- may read or write them.

-- ---------------------------------------------------------------------------
-- Seed sources
-- ---------------------------------------------------------------------------
insert into public.sources (name, listing_url, parser_strategy, is_active)
values
  ('arXiv cs.AI', 'https://arxiv.org/list/cs.AI/recent', 'arxiv', true),
  ('OpenAI Blog', 'https://openai.com/news/', 'generic_blog', true),
  ('Google Research Blog', 'https://research.google/blog/', 'generic_blog', true),
  ('GitHub Trending TypeScript', 'https://github.com/trending/typescript?since=daily', 'github_trending', true),
  ('Hugging Face Daily Papers', 'https://huggingface.co/papers', 'huggingface', true)
on conflict (listing_url) do nothing;
