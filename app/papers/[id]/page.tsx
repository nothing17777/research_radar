import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/research-radar/site-header";
import { BrowseView } from "@/components/research-radar/browse-view";
import { getPapersForDisplay, getRelatedPapers } from "@/lib/supabase/queries/papers";

export default async function PaperDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const allItems = await getPapersForDisplay();
  const selected = allItems.find((item) => item.paper.id === id);
  if (!selected) notFound();

  // Keep the list scoped to the same kind as the selected item, so opening a
  // paper doesn't pull repos into the side list (and vice versa).
  const items = allItems.filter((item) => item.kind === selected.kind);
  const related = selected.analysis.embedding
    ? await getRelatedPapers(selected.paper.id, selected.analysis.embedding)
    : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <SiteHeader active={selected.kind === "repo" ? "repos" : "papers"} />
      <main className="mx-auto flex w-full min-h-0 max-w-7xl flex-1 flex-col">
        <BrowseView items={items} initialSelectedId={id} related={related} />
      </main>
    </div>
  );
}
