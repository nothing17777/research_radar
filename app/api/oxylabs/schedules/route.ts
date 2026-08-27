import { NextRequest, NextResponse } from "next/server";
import { syncSchedules } from "@/lib/scraping/schedulerPipeline";
import { getAllSchedules } from "@/lib/supabase/queries/schedules";

function checkAdminSecret(request: NextRequest): boolean {
  const adminSecret = request.headers.get("x-radar-admin-secret");
  return Boolean(adminSecret) && adminSecret === process.env.RADAR_ADMIN_SECRET;
}

export async function POST(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await syncSchedules();
  return NextResponse.json(summary);
}

export async function GET(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schedules = await getAllSchedules();
  return NextResponse.json({ schedules });
}
