import { NextRequest, NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/supabase/queries/logs";

export async function GET(request: NextRequest) {
  const adminSecret = request.headers.get("x-radar-admin-secret");
  if (!adminSecret || adminSecret !== process.env.RADAR_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const logs = await getRecentLogs(limit);
  return NextResponse.json({ logs });
}
