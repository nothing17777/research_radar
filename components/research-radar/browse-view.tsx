"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CategoryCombobox } from "@/components/research-radar/category-combobox";
import { PaperListRow } from "@/components/research-radar/paper-list-row";
import { PaperDetailPanel } from "@/components/research-radar/paper-detail-panel";
import { toCardData } from "@/lib/papers/toCardData";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/components/research-radar/difficulty-badge";
import type { ItemKind, PaperDisplayItem } from "@/lib/supabase/queries/papers";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "expert"];
const DESKTOP_BREAKPOINT_QUERY = "(min-width: 1024px)";

export function BrowseView({
  items,
  initialSelectedId,
  related = [],
  showKindFilter = false,
}: {
  items: PaperDisplayItem[];
  initialSelectedId?: string;
  related?: PaperDisplayItem[];
  showKindFilter?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ItemKind | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? items[0]?.paper.id ?? null
  );

  const allCategories = useMemo(
    () => Array.from(new Set(items.map((item) => item.analysis.primary_category))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (kind && item.kind !== kind) return false;
      if (difficulty && item.analysis.difficulty_label !== difficulty) return false;
      if (categories.size > 0 && !categories.has(item.analysis.primary_category)) return false;
      if (!q) return true;
      return (
        item.paper.title.toLowerCase().includes(q) ||
        item.analysis.neutral_summary.toLowerCase().includes(q) ||
        item.analysis.core_methodology.toLowerCase().includes(q)
      );
    });
  }, [items, query, kind, difficulty, categories]);

  const selectedItem = filtered.find((item) => item.paper.id === selectedId) ?? filtered[0] ?? null;
  const isDetailRoute = Boolean(initialSelectedId);

  function toggleCategory(category: string) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function handleSelect(id: string, e: React.MouseEvent) {
    const isDesktop = typeof window !== "undefined" && window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches;
    if (!isDesktop) return; // let the Link navigate normally on small screens
    e.preventDefault();
    setSelectedId(id);
    router.replace(`/papers/${id}`, { scroll: false });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-6">
      {isDetailRoute ? (
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden"
        >
          ← Back to list
        </Link>
      ) : null}

      <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", isDetailRoute && "hidden lg:flex")}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search papers and repos..."
            className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-indigo"
          />
        </div>
      </div>

      <div className={cn("flex flex-wrap items-center gap-2", isDetailRoute && "hidden lg:flex")}>
        {showKindFilter ? (
          <>
            <button
              type="button"
              onClick={() => setKind(null)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out",
                kind === null
                  ? "border-accent-indigo text-accent-indigo"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setKind("paper")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out",
                kind === "paper"
                  ? "border-accent-indigo text-accent-indigo"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Papers
            </button>
            <button
              type="button"
              onClick={() => setKind("repo")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out",
                kind === "repo"
                  ? "border-accent-indigo text-accent-indigo"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Repos
            </button>
            <span className="mx-1 h-4 w-px bg-border" />
          </>
        ) : null}
        <button
          type="button"
          onClick={() => setDifficulty(null)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out",
            difficulty === null
              ? "border-accent-indigo text-accent-indigo"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          All difficulties
        </button>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDifficulty(d === difficulty ? null : d)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors duration-150 ease-out",
              difficulty === d
                ? "border-accent-indigo text-accent-indigo"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {d}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <CategoryCombobox categories={allCategories} selected={categories} onToggle={toggleCategory} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div
          className={cn(
            "flex h-full flex-col gap-3 overflow-y-auto",
            isDetailRoute && "hidden lg:flex",
          )}
        >
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No results match your filters.</p>
          ) : (
            filtered.map((item) => (
              <Link
                key={item.paper.id}
                href={`/papers/${item.paper.id}`}
                onClick={(e) => handleSelect(item.paper.id, e)}
              >
                <PaperListRow data={toCardData(item)} active={item.paper.id === selectedItem?.paper.id} />
              </Link>
            ))
          )}
        </div>

        <div
          className={cn(
            "h-full overflow-y-auto",
            isDetailRoute ? "block" : "hidden lg:block",
          )}
        >
          {selectedItem ? (
            <PaperDetailPanel item={selectedItem} related={related} />
          ) : (
            <p className="text-sm text-muted-foreground">Select an item to see details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
