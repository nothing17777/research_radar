import { Loader2 } from "lucide-react";

export function LoadingSpinner() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-accent-indigo" />
    </div>
  );
}
