import { cn } from "@/lib/utils";
import type { Difficulty } from "./difficulty-badge";

const SEGMENTS: { key: Difficulty; label: string; classes: string }[] = [
  {
    key: "beginner",
    label: "Beginner",
    classes:
      "bg-difficulty-beginner-bg text-difficulty-beginner-fg border-difficulty-beginner-border",
  },
  {
    key: "intermediate",
    label: "Intermediate",
    classes:
      "bg-difficulty-intermediate-bg text-difficulty-intermediate-fg border-difficulty-intermediate-border",
  },
  {
    key: "expert",
    label: "Expert",
    classes:
      "bg-difficulty-expert-bg text-difficulty-expert-fg border-difficulty-expert-border",
  },
];

export function DifficultyMeter({
  active,
  className,
}: {
  active: Difficulty;
  className?: string;
}) {
  return (
    <div className={cn("flex overflow-hidden rounded-lg border border-border", className)}>
      {SEGMENTS.map((segment) => (
        <div
          key={segment.key}
          className={cn(
            "flex-1 border-r border-border px-3 py-2 text-center text-xs font-medium last:border-r-0",
            segment.key === active ? segment.classes : "bg-muted text-muted-foreground",
          )}
        >
          {segment.label}
        </div>
      ))}
    </div>
  );
}
