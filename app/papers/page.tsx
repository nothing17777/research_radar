import { SiteHeader } from "@/components/research-radar/site-header";
import { BrowseView } from "@/components/research-radar/browse-view";
import { getPapersForDisplay, getRelatedPapers } from "@/lib/supabase/queries/papers";

export default async function PapersPage() {
  const items = await getPapersForDisplay();
  const papers = items.filter((item) => item.kind === "paper");
  const selected = papers[0];
  const related = selected?.analysis.embedding
    ? await getRelatedPapers(selected.paper.id, selected.analysis.embedding)
    : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <SiteHeader active="papers" />
      <main className="mx-auto flex w-full min-h-0 max-w-7xl flex-1 flex-col">
        <BrowseView items={papers} related={related} />
      </main>
    </div>
  );
}
