import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DifficultyBadge } from "@/components/research-radar/difficulty-badge";
import { KindIcon } from "@/components/research-radar/kind-icon";
import type { PaperCardData } from "@/components/research-radar/paper-card";

export function PaperListRow({
  data,
  active,
}: {
  data: PaperCardData;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border-l-2 border border-border bg-card p-4 transition-[background-color,border-color,box-shadow] duration-150 ease-out",
        active
          ? "border-l-accent-indigo bg-secondary/40"
          : "border-l-transparent hover:border-border/80 hover:bg-secondary/20 hover:shadow-[var(--shadow-sm-token)]",
      )}
    >
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        <KindIcon kind={data.kind} />
        {data.kind === "repo" ? "GitHub repo" : "Paper"}
      </span>
      <h3 className="text-sm font-semibold text-card-foreground">{data.title}</h3>
      <p className="line-clamp-2 text-xs text-muted-foreground">{data.excerpt}</p>
      <div className="flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={data.difficulty} />
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          {data.publishedLabel}
        </span>
      </div>
    </div>
  );
}
