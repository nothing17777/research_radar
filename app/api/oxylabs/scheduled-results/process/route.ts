import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processScheduledRuns } from "@/lib/scraping/schedulerPipeline";

const requestSchema = z.object({
  scheduleIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get("x-radar-admin-secret");
  if (!adminSecret || adminSecret !== process.env.RADAR_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const summary = await processScheduledRuns(parsed.data);
  return NextResponse.json(summary);
}
