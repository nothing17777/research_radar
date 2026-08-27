import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { PaperAnalysisRow, PaperInsert, PaperRow, SourceRow } from "@/lib/supabase/types";

const URL_CHUNK_SIZE = 15;

export type ItemKind = "paper" | "repo";

export interface PaperDisplayItem {
  paper: PaperRow;
  analysis: PaperAnalysisRow;
  source: SourceRow;
  kind: ItemKind;
}

function kindForSource(source: SourceRow): ItemKind {
  return source.parser_strategy === "github_trending" ? "repo" : "paper";
}

// Joins papers + paper_analyses + sources in JS (never .eq() a joined table's
// column — see AGENTS.md section 21 on the Supabase joined-table filter gotcha).
async function joinPapersWithAnalysisAndSource(papers: PaperRow[]): Promise<PaperDisplayItem[]> {
  if (papers.length === 0) return [];

  const supabase = createServiceRoleSupabaseClient();
  const paperIds = papers.map((p) => p.id);
  const sourceIds = Array.from(new Set(papers.map((p) => p.source_id)));

  const [{ data: analyses, error: analysesError }, { data: sources, error: sourcesError }] =
    await Promise.all([
      supabase.from("paper_analyses").select("*").in("paper_id", paperIds),
      supabase.from("sources").select("*").in("id", sourceIds),
    ]);

  if (analysesError) throw analysesError;
  if (sourcesError) throw sourcesError;

  const analysisByPaperId = new Map(analyses.map((a) => [a.paper_id, a]));
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const items: PaperDisplayItem[] = [];
  for (const paper of papers) {
    const analysis = analysisByPaperId.get(paper.id);
    const source = sourceById.get(paper.source_id);
    if (!analysis || !source) continue;
    items.push({ paper, analysis, source, kind: kindForSource(source) });
  }
  return items;
}

export async function getPapersForDisplay(limit = 300, offset = 0): Promise<PaperDisplayItem[]> {
  const papers = await getPapersWithAnalysis(limit, offset);
  return joinPapersWithAnalysisAndSource(papers);
}


export async function getPaperByOriginalUrl(url: string): Promise<PaperRow | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("papers")
    .select("*")
    .eq("original_url", url)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Returns the subset of `urls` that already exist in `papers.original_url`.
export async function getExistingOriginalUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();

  const supabase = createServiceRoleSupabaseClient();
  const existing = new Set<string>();

  for (let i = 0; i < urls.length; i += URL_CHUNK_SIZE) {
    const chunk = urls.slice(i, i + URL_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("papers")
      .select("original_url")
      .in("original_url", chunk);

    if (error) throw error;
    for (const row of data) existing.add(row.original_url);
  }

  return existing;
}

export async function insertPaper(paper: PaperInsert): Promise<PaperRow> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("papers").insert(paper).select().single();

  if (error) throw error;
  return data;
}

// Pending analysis = no row in paper_analyses for the paper. Supabase-js can't
// filter on a joined table's null-ness reliably, so fetch both sides and diff in JS.
export async function getPendingAnalysisPapers(limit?: number): Promise<PaperRow[]> {
  const supabase = createServiceRoleSupabaseClient();

  const [{ data: papers, error: papersError }, { data: analyses, error: analysesError }] =
    await Promise.all([
      supabase.from("papers").select("*").order("scraped_at", { ascending: true }),
      supabase.from("paper_analyses").select("paper_id"),
    ]);

  if (papersError) throw papersError;
  if (analysesError) throw analysesError;

  const analyzedIds = new Set(analyses.map((a) => a.paper_id));
  const pending = papers.filter((p) => !analyzedIds.has(p.id));

  return limit ? pending.slice(0, limit) : pending;
}

export async function markPaperAnalyzed(paperId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("papers")
    .update({ analyzed_at: new Date().toISOString() })
    .eq("id", paperId);

  if (error) throw error;
}

export async function getPapersWithAnalysis(
  limit = 300,
  offset = 0
): Promise<PaperRow[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("papers")
    .select("*")
    .not("analyzed_at", "is", null)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data;
}

const RELATED_PAPERS_LIMIT = 5;

// Cosine-similarity related papers (AGENTS.md section 20). Uses the
// match_related_papers SQL function since supabase-js can't order by a raw
// `<=>` expression.
export async function getRelatedPapers(
  paperId: string,
  embedding: number[]
): Promise<PaperDisplayItem[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: matches, error } = (await supabase.rpc("match_related_papers", {
    query_embedding: embedding,
    match_paper_id: paperId,
    match_count: RELATED_PAPERS_LIMIT,
  })) as { data: { paper_id: string; distance: number }[] | null; error: { message: string } | null };

  if (error) throw error;
  if (!matches || matches.length === 0) return [];

  const paperIds = matches.map((m) => m.paper_id);
  const { data: papers, error: papersError } = await supabase
    .from("papers")
    .select("*")
    .in("id", paperIds);

  if (papersError) throw papersError;

  const items = await joinPapersWithAnalysisAndSource(papers);
  const orderById = new Map<string, number>(paperIds.map((id, index) => [id, index]));
  return items.sort((a, b) => orderById.get(a.paper.id)! - orderById.get(b.paper.id)!);
}
