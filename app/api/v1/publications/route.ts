import { NextRequest, NextResponse } from "next/server";
import { mapPublicationRow } from "@/lib/publication-mapping";
import { getSupabaseAdmin } from "@/lib/supabase-server";

import { readPage, nextCursor } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  let page;
  try { page = readPage(request.nextUrl.searchParams); }
  catch { return NextResponse.json({ error: { code: "INVALID_PAGINATION" } }, { status: 422 }); }
  try {
    let query = getSupabaseAdmin().from("publications").select("*, people(name), source_items(canonical_url, discovered_at, current_version, sources(name), source_versions(id, version, title, content, published_at, structured)), event_mentions(event_id)").order("id", { ascending: false }).limit(page.limit + 1);
    if (page.cursor) query = query.lt("id", page.cursor.id);
    const { data: rows, error } = await query;
    if (error) throw error;
    const data = (rows ?? []).slice(0, page.limit).map(mapPublicationRow);
    return NextResponse.json({ data, meta: { count: data.length, mode: "live", next_cursor: rows && rows.length > page.limit ? nextCursor(data.at(-1)!.id) : null } });
  } catch (error) {
    return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: "Lecture impossible" } }, { status: 503 });
  }
}
