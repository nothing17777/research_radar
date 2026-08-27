import Image from "next/image";
import { Clock, BookOpen, Info } from "lucide-react";
import { CategoryPill } from "@/components/research-radar/category-pill";
import { Card, CardContent } from "@/components/ui/card";
import { DifficultyBadge } from "@/components/research-radar/difficulty-badge";
import { DifficultyMeter } from "@/components/research-radar/difficulty-meter";
import { PaperCard } from "@/components/research-radar/paper-card";
import { KindIcon } from "@/components/research-radar/kind-icon";
import type { PaperDisplayItem } from "@/lib/supabase/queries/papers";
import { toCardData } from "@/lib/papers/toCardData";
import { formatReadTime, formatRelativeTime } from "@/lib/papers/display";

export function PaperDetailPanel({
  item,
  related,
}: {
  item: PaperDisplayItem;
  related: PaperDisplayItem[];
}) {
  const { paper, analysis, source } = item;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <article className="flex flex-col gap-6 lg:col-span-2">
          <div className="flex flex-col gap-3">
            <span className="text-xs text-muted-foreground">
              {analysis.primary_category} · {source.name}
            </span>
            <h1 className="text-3xl font-bold">{paper.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <KindIcon kind={item.kind} />
                {source.name}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatRelativeTime(paper.published_at)}
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="size-3.5" />
                {formatReadTime(paper.raw_text)}
              </span>
              <DifficultyBadge difficulty={analysis.difficulty_label} />
            </div>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border">
            <Image
              src={paper.image_url ?? "/paper-placeholder.svg"}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 66vw"
            />
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Technical Difficulty</h2>
              <DifficultyMeter active={analysis.difficulty_label} />
              <p className="text-xs text-muted-foreground">
                Score {analysis.technical_difficulty_score}/10 · AI-estimated from the paper&apos;s
                methodology and prerequisites.
              </p>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 text-sm leading-relaxed text-foreground">
            <p>{analysis.neutral_summary}</p>
            <h2 className="text-lg font-semibold">Core Methodology</h2>
            <p className="whitespace-pre-line">{analysis.core_methodology}</p>
            {analysis.prerequisites && analysis.prerequisites.length > 0 ? (
              <>
                <h2 className="text-lg font-semibold">Prerequisites</h2>
                <ul className="flex flex-col gap-1">
                  {analysis.prerequisites.map((prereq) => (
                    <li key={prereq} className="flex gap-2">
                      <span className="text-accent-indigo">•</span>
                      <span>{prereq}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </article>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-md-token)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">AI-Estimated Difficulty</h2>
              <Info className="size-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">{analysis.technical_difficulty_score}/10</span>
              <DifficultyBadge difficulty={analysis.difficulty_label} />
            </div>
            <span className="text-xs text-muted-foreground">
              Confidence: {Math.round(analysis.confidence * 100)}%
            </span>
            <hr className="border-border" />
            <p className="text-xs text-muted-foreground">{analysis.disclaimer}</p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-md-token)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Key Takeaways</h2>
              <Info className="size-4 text-muted-foreground" />
            </div>
            <span className="text-[11px] text-muted-foreground">
              Generated {formatRelativeTime(analysis.created_at)}
            </span>
            <ul className="flex flex-col gap-3 text-sm">
              {analysis.key_takeaways.map((takeaway, index) => (
                <li key={index} className="flex gap-2">
                  <span className="text-accent-indigo">•</span>
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
            <span className="text-[11px] text-muted-foreground">
              AI takeaways can make mistakes.
            </span>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-md-token)]">
            <h2 className="text-sm font-semibold">Source</h2>
            <span className="text-sm">{source.name}</span>
            <div className="flex flex-wrap gap-1.5">
              <CategoryPill label={analysis.primary_category} />
            </div>
            <a
              href={paper.canonical_url ?? paper.original_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent-indigo hover:underline"
            >
              View original {item.kind === "repo" ? "repo" : "paper"}
            </a>
          </div>
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Related Research</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((relatedItem) => (
              <PaperCard key={relatedItem.paper.id} data={toCardData(relatedItem)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
