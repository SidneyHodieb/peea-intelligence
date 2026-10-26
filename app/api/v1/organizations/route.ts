import { NextResponse } from "next/server";
import { getSupabaseAdmin, initials } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: rows, error }, { data: liveEvents, error: eventError }] = await Promise.all([
      supabase.from("organizations").select("*, partnership_opportunities(id, event_id, status, suggestion)").order("name", { ascending: true }).limit(100),
      supabase.from("events").select("data").eq("status", "scheduled").eq("is_demo", false),
    ]);
    if (error) throw error;
    if (eventError) throw eventError;
    const liveCounts = new Map<string, number>();
    for (const event of liveEvents ?? []) {
      const organizationId = (event.data as Record<string, unknown> | null)?.organizerId;
      if (typeof organizationId === "string") liveCounts.set(organizationId, (liveCounts.get(organizationId) ?? 0) + 1);
    }
    const data = (rows ?? []).filter(row => liveCounts.has(row.id)).map(row => {
      const opportunities = row.partnership_opportunities as Array<{ event_id?: string; status?: string }> | null;
      const opportunity = opportunities?.[0];
      const stageMap: Record<string, string> = { identified: "Découvert", qualifying: "À qualifier", qualified: "Qualifié", contact: "À contacter", contacted: "Contacté", discussing: "En discussion", partner: "Partenaire" };
      return {
        id: row.id, name: row.name, role: "Organisateur détecté", sector: "À qualifier",
        eventCount: liveCounts.get(row.id) ?? 0, score: opportunities?.length ? Math.min(60 + opportunities.length * 10, 95) : 40,
        stage: stageMap[opportunity?.status ?? "identified"] ?? "Découvert", initials: initials(row.name),
      };
    });
    return NextResponse.json({ data, meta: { count: data.length, mode: "live" } });
  } catch (error) {
    return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: error instanceof Error ? error.message : "Erreur Supabase" } }, { status: 503 });
  }
}
