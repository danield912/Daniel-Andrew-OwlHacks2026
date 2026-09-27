import { NextRequest, NextResponse } from "next/server";
import { lineStatuses } from "@/lib/septa";

const LINE_PATTERN = /^[A-Za-z0-9 .'&/-]{1,40}$/;

// GET /api/transit/status?lines=B1,17 -> { lines: LineStatus[] }
// Live SEPTA status (public data, cached for a minute on the server).
export async function GET(request: NextRequest) {
  const lines = (request.nextUrl.searchParams.get("lines") ?? "")
    .split(",")
    .map(line => line.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > 6 || !lines.every(line => LINE_PATTERN.test(line))) {
    return NextResponse.json({ error: "Send up to 6 line names, like ?lines=B1,17." }, { status: 400 });
  }
  const statuses = await lineStatuses(lines);
  return NextResponse.json({ lines: statuses }, { headers: { "Cache-Control": "public, max-age=60" } });
}
