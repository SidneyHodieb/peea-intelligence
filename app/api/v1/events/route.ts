import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, mapEventRow } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const city = searchParams.get("city");
    const minScore = Number(searchParams.get("min_score") ?? 0);
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
    let query = getSupabaseAdmin().from("events").select("*").gte("relevance", minScore).eq("status", "scheduled").eq("is_demo", false).order("updated_at", { ascending: false }).limit(limit);
    const { data: rows, error } = await query;
    if (error) throw error;
    let data = (rows ?? []).map(row => mapEventRow(row));
    if (city) data = data.filter(event => event.city === city);
    return NextResponse.json({ data, meta: { count: data.length, mode: "live", next_cursor: null } });
  } catch (error) {
    return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: error instanceof Error ? error.message : "Erreur Supabase" } }, { status: 503 });
  }
}
