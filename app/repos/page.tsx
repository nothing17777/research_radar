import { SiteHeader } from "@/components/research-radar/site-header";
import { BrowseView } from "@/components/research-radar/browse-view";
import { getPapersForDisplay, getRelatedPapers } from "@/lib/supabase/queries/papers";

export default async function ReposPage() {
  const items = await getPapersForDisplay();
  const repos = items.filter((item) => item.kind === "repo");
  const selected = repos[0];
  const related = selected?.analysis.embedding
    ? await getRelatedPapers(selected.paper.id, selected.analysis.embedding)
    : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <SiteHeader active="repos" />
      <main className="mx-auto flex w-full min-h-0 max-w-7xl flex-1 flex-col">
        <BrowseView items={repos} related={related} />
      </main>
    </div>
  );
}
