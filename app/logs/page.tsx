import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SiteHeader } from "@/components/research-radar/site-header";
import { Badge } from "@/components/ui/badge";
import { getRecentLogs } from "@/lib/supabase/queries/logs";
import { formatRelativeTime } from "@/lib/papers/display";
import { cn } from "@/lib/utils";
import type { LogLevel } from "@/lib/supabase/types";

const LEVEL_CLASSES: Record<LogLevel, string> = {
  info: "border-border text-muted-foreground",
  warn: "border-difficulty-intermediate-border text-difficulty-intermediate-fg",
  error: "border-difficulty-expert-border text-difficulty-expert-fg",
};

export default async function LogsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const logs = await getRecentLogs();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader active="home" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-6 py-8">
        <h1 className="text-2xl font-bold">Pipeline Logs</h1>
        <p className="text-sm text-muted-foreground">
          Most recent {logs.length} log entries from scrape, analysis, and scheduler runs.
        </p>

        <div className="flex flex-col gap-3">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs yet.</p>
          ) : (
            logs.map((log) => (
              <details
                key={log.id}
                className="rounded-xl border border-border bg-card p-4 open:shadow-[var(--shadow-sm-token)]"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                  <Badge variant="outline" className={cn("uppercase", LEVEL_CLASSES[log.level])}>
                    {log.level}
                  </Badge>
                  <span className="flex-1 font-medium text-card-foreground">{log.message}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(log.created_at)}
                  </span>
                </summary>
                {log.context ? (
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
                    {JSON.stringify(log.context, null, 2)}
                  </pre>
                ) : null}
              </details>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
