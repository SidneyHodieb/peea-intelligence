import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, mapEventRow } from "@/lib/supabase-server";
import { readPage, nextCursor } from "@/lib/pagination";
export async function GET(request: NextRequest) {
  let page;
  try { page = readPage(request.nextUrl.searchParams); }
  catch { return NextResponse.json({ error: { code: "INVALID_PAGINATION" } }, { status: 422 }); }
  const params = request.nextUrl.searchParams;
  const minScore = Number(params.get("min_score") ?? 0);
  if (!Number.isInteger(minScore) || minScore < 0 || minScore > 100) return NextResponse.json({ error: { code: "INVALID_SCORE" } }, { status: 422 });
  try {
    let query = getSupabaseAdmin().from("events").select("*").gte("relevance", minScore).eq("status", "scheduled").eq("is_demo", false).order("id", { ascending: false }).limit(page.limit + 1);
    if (params.get("city")) query = query.eq("data->>city", params.get("city"));
    if (page.cursor) query = query.lt("id", page.cursor.id);
    const { data: rows, error } = await query;
    if (error) throw error;
    const slice = (rows ?? []).slice(0, page.limit);
    return NextResponse.json({ data: slice.map(mapEventRow), meta: { count: slice.length, mode: "live", next_cursor: rows && rows.length > page.limit ? nextCursor(String(slice.at(-1)!.id)) : null } });
  } catch (error) {
    console.error("events_read_failed", error);
    return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: "Lecture impossible" } }, { status: 503 });
  }
}
