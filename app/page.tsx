import { auth } from "@clerk/nextjs/server";
import { SiteHeader } from "@/components/research-radar/site-header";
import { BrowseView } from "@/components/research-radar/browse-view";
import { LandingPage } from "@/components/research-radar/landing-page";
import { getPapersForDisplay, getRelatedPapers } from "@/lib/supabase/queries/papers";

export default async function Home() {
  const { userId } = await auth();
  if (!userId) {
    return <LandingPage />;
  }

  const items = await getPapersForDisplay();
  const selected = items[0];
  const related = selected?.analysis.embedding
    ? await getRelatedPapers(selected.paper.id, selected.analysis.embedding)
    : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <SiteHeader active="home" />
      <main className="mx-auto flex w-full min-h-0 max-w-7xl flex-1 flex-col">
        <BrowseView items={items} related={related} showKindFilter />
      </main>
    </div>
  );
}
