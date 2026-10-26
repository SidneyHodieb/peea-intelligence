import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const { data: rows, error } = await getSupabaseAdmin().from("publications").select("*, people(name), source_items(canonical_url, current_version, sources(name), source_versions(id, version, title, content, structured)), event_mentions(event_id)").order("published_at", { ascending: false }).limit(100);
    if (error) throw error;
    const data = (rows ?? []).map(row => {
      const sourceItem = row.source_items as { canonical_url?: string; current_version?: number; sources?: { name?: string } | null; source_versions?: Array<{ version?: number; title?: string; content?: string; structured?: Record<string, unknown> }> } | null;
      const version = sourceItem?.source_versions?.sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
      const structured = version?.structured ?? {};
      const mentions = row.event_mentions as Array<{ event_id?: string }> | null;
      return {
        id: row.id, source: sourceItem?.sources?.name ?? "Source web", sourceUrl: sourceItem?.canonical_url,
        author: (row.people as { name?: string } | null)?.name ?? "Rédaction",
        organization: String(structured.organizer ?? sourceItem?.sources?.name ?? "Source à qualifier"),
        publishedAt: row.published_at ?? new Date().toISOString(), title: version?.title ?? "Publication sans titre", excerpt: row.summary ?? version?.content?.slice(0, 1000) ?? "",
        eventId: mentions?.[0]?.event_id ?? "", quality: row.platform === "openagenda" ? "Source officielle" : "À vérifier",
      };
    });
    return NextResponse.json({ data, meta: { count: data.length, mode: "live" } });
  } catch (error) {
    return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: error instanceof Error ? error.message : "Erreur Supabase" } }, { status: 503 });
  }
}
