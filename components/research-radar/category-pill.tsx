import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CategoryPill({
  label,
  onAdd,
  onRemove,
  className,
}: {
  label: string;
  onAdd?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("max-w-full gap-1", className)}>
      <span className="truncate">{label}</span>
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add ${label}`}
          data-icon="inline-end"
          className="inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
        >
          <Plus className="size-3" />
        </button>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          data-icon="inline-end"
          className="inline-flex size-3.5 items-center justify-center rounded-full text-white/80 transition-colors duration-150 ease-out hover:text-white"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </Badge>
  );
}
