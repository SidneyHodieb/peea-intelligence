import { NextResponse } from "next/server";
import { getSourceCatalog, validateCatalog } from "@/lib/discovery-config";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  const catalog = validateCatalog();
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const connectors = {
    openagenda: process.env.OPENAGENDA_API_KEY ? "configured" : "not_configured",
    brave: process.env.BRAVE_SEARCH_API_KEY ? "configured" : "not_configured",
    rss: "ready",
    targeted_web: "ready",
    supabase: supabaseUrl && supabasePublishableKey && supabaseSecretKey ? "configured" : "not_configured",
  };
  const ready = catalog.valid && connectors.openagenda === "configured" && connectors.brave === "configured";
  let storage = { events: 0, publications: 0, organizations: 0 };
  let lastSuccess: string | null = null;
  if (connectors.supabase === "configured") {
    const supabase = getSupabaseAdmin();
    const [events, publications, organizations, sources] = await Promise.all([
      supabase.from("events").select("*", { count: "exact", head: true }).eq("is_demo", false).eq("status", "scheduled"),
      supabase.from("publications").select("*", { count: "exact", head: true }),
      supabase.from("organizations").select("*", { count: "exact", head: true }),
      supabase.from("sources").select("last_success").not("last_success", "is", null).order("last_success", { ascending: false }).limit(1).maybeSingle(),
    ]);
    storage = { events: events.count ?? 0, publications: publications.count ?? 0, organizations: organizations.count ?? 0 };
    lastSuccess = sources.data?.last_success ?? null;
  }
  return NextResponse.json({ data: { status: ready ? "collectors_ready" : "ready_for_configuration", last_success: lastSuccess, connectors, storage, catalog: { sources: getSourceCatalog().length, rss: getSourceCatalog().filter(source => source.type === "rss").length, valid: catalog.valid } } });
}
