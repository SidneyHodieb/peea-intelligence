import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scoreCandidate } from "@/lib/processing";
import { normalizeTitle } from "@/lib/processing";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { createHash } from "node:crypto";

const candidateSchema = z.object({ title: z.string().min(3).max(300), description: z.string().max(10000).default(""), city: z.string().max(100).optional(), date: z.iso.datetime().optional(), source_url: z.url() });
export async function POST(request: NextRequest) {
  if (!process.env.INTERNAL_API_TOKEN || request.headers.get("authorization") !== `Bearer ${process.env.INTERNAL_API_TOKEN}`) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Jeton interne invalide" } }, { status: 401 });
  const parsed = candidateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 422 });
  const result = scoreCandidate({ ...parsed.data, future: parsed.data.date ? new Date(parsed.data.date) > new Date() : false });
  const supabase = getSupabaseAdmin();
  const { data: source, error: sourceError } = await supabase.from("sources").select("id").eq("name", "Ingestion interne").maybeSingle();
  if (sourceError) return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: sourceError.message } }, { status: 503 });
  let sourceId = source?.id;
  if (!sourceId) {
    const { data: created, error } = await supabase.from("sources").insert({ name: "Ingestion interne", kind: "api", config: {}, enabled: true, official: false, public_analysis: true, retain_content: true, access_method: "api", restrictions: "", frequency_minutes: 60 }).select("id").single();
    if (error) return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: error.message } }, { status: 503 });
    sourceId = created.id;
  }
  const nativeId = createHash("sha256").update(parsed.data.source_url).digest("hex").slice(0, 32);
  const { data: sourceItem, error: itemError } = await supabase.from("source_items").upsert({ source_id: sourceId, native_id: nativeId, canonical_url: parsed.data.source_url, current_version: 1, last_seen_at: new Date().toISOString() }, { onConflict: "source_id,native_id" }).select("id").single();
  if (itemError) return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: itemError.message } }, { status: 503 });
  const contentHash = createHash("sha256").update(`${parsed.data.title}\n${parsed.data.description}`).digest("hex");
  const { error: versionError } = await supabase.from("source_versions").upsert({ item_id: sourceItem.id, version: 1, title: parsed.data.title, content: parsed.data.description, content_hash: contentHash, access_level: "metadata", rights: { source_url: parsed.data.source_url }, structured: parsed.data, state: "processed", attempts: 1, processing_outcome: "accepted", processing_details: { method: "internal_api" }, processed_at: new Date().toISOString() }, { onConflict: "item_id,version" });
  if (versionError) return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: versionError.message } }, { status: 503 });
  const identityKey = `${normalizeTitle(parsed.data.title)}|${parsed.data.date?.slice(0, 10) ?? "undated"}|${normalizeTitle(parsed.data.city ?? "online")}`;
  const { data: event, error: eventError } = await supabase.from("events").upsert({
    identity_key: identityKey, title: parsed.data.title, data: { startsAt: parsed.data.date, city: parsed.data.city, description: parsed.data.description, registrationUrl: parsed.data.source_url, scoreReasons: result.reasons },
    relevance: result.score, verification: "unverified", status: "scheduled", is_demo: false, updated_at: new Date().toISOString(),
  }, { onConflict: "identity_key" }).select("id").single();
  if (eventError) return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: eventError.message } }, { status: 503 });
  await supabase.from("publications").upsert({ item_id: sourceItem.id, platform: "internal", summary: parsed.data.description.slice(0, 600), published_at: new Date().toISOString() }, { onConflict: "item_id" });
  return NextResponse.json({ data: { id: event.id, classification: result, persistence: "supabase" } }, { status: 201 });
}
