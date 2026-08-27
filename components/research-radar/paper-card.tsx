import Image from "next/image";
import Link from "next/link";
import { Clock, BookOpen } from "lucide-react";
import { DifficultyBadge, type Difficulty } from "./difficulty-badge";
import { CategoryPill } from "./category-pill";
import { KindIcon } from "./kind-icon";
import type { ItemKind } from "@/lib/supabase/queries/papers";

export type PaperCardData = {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  categories: string[];
  difficulty: Difficulty;
  confidence?: number;
  publishedLabel: string;
  readTimeLabel: string;
  kind: ItemKind;
};

export function PaperCard({ data }: { data: PaperCardData }) {
  return (
    <Link
      href={`/papers/${data.id}`}
      className="group block w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-md-token)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1 [@media(hover:hover)_and_(pointer:fine)]:hover:border-border/80 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-video w-full overflow-hidden">
        <Image
          src={data.imageUrl}
          alt=""
          fill
          className="object-cover transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
          sizes="(max-width: 640px) 100vw, 384px"
        />
      </div>
      <div className="flex flex-col gap-2 p-4">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <KindIcon kind={data.kind} />
          {data.kind === "repo" ? "GitHub repo" : "Paper"}
        </span>
        <h3 className="text-lg font-semibold text-card-foreground group-hover:underline">
          {data.title}
        </h3>
        <p className="text-sm text-muted-foreground">{data.excerpt}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {data.categories.map((category) => (
            <CategoryPill key={category} label={category} className="min-w-0" />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <DifficultyBadge difficulty={data.difficulty} className="shrink-0" />
          {data.confidence != null ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {Math.round(data.confidence * 100)}% confidence
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {data.publishedLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3.5" />
            {data.readTimeLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
