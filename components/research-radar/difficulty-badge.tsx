import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Difficulty = "beginner" | "intermediate" | "expert";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
};

const DIFFICULTY_CLASSES: Record<Difficulty, string> = {
  beginner:
    "bg-difficulty-beginner-bg text-difficulty-beginner-fg border-difficulty-beginner-border",
  intermediate:
    "bg-difficulty-intermediate-bg text-difficulty-intermediate-fg border-difficulty-intermediate-border",
  expert:
    "bg-difficulty-expert-bg text-difficulty-expert-fg border-difficulty-expert-border",
};

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(DIFFICULTY_CLASSES[difficulty], className)}>
      {DIFFICULTY_LABEL[difficulty]}
    </Badge>
  );
}
