import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evidenceSchema, eventCandidateSchema, importEvent } from "@/lib/external-enrichment";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const requestSchema = z.object({ evidence: evidenceSchema, patch: eventCandidateSchema.partial(), dryRun: z.boolean().default(false) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 422 });
  const { id } = await params;
  const { data: current, error } = await getSupabaseAdmin().from("events").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: "Lecture impossible" } }, { status: 503 });
  if (!current) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Événement introuvable" } }, { status: 404 });
  const data = (current.data ?? {}) as Record<string, unknown>;
  const candidate = eventCandidateSchema.parse({
    title: parsed.data.patch.title ?? current.title, description: parsed.data.patch.description ?? data.description ?? "",
    startsAt: parsed.data.patch.startsAt ?? data.startsAt, endsAt: parsed.data.patch.endsAt ?? data.endsAt,
    city: parsed.data.patch.city ?? data.city, region: parsed.data.patch.region ?? data.region, country: parsed.data.patch.country ?? data.country,
    venue: parsed.data.patch.venue ?? data.venue, organizer: parsed.data.patch.organizer ?? data.organizer,
    organizerWebsite: parsed.data.patch.organizerWebsite, category: parsed.data.patch.category ?? data.category,
    countries: parsed.data.patch.countries ?? data.countries ?? [], registrationUrl: parsed.data.patch.registrationUrl ?? data.registrationUrl,
    relevance: parsed.data.patch.relevance ?? current.relevance, verification: parsed.data.patch.verification ?? current.verification,
    status: parsed.data.patch.status ?? current.status,
  });
  if (parsed.data.dryRun) return NextResponse.json({ data: { id, valid: true, dry_run: true, title: candidate.title } });
  try {
    const result = await importEvent(candidate, parsed.data.evidence, id);
    return NextResponse.json({ data: result });
  } catch (cause) {
    return NextResponse.json({ error: { code: "ENRICHMENT_ERROR", message: cause instanceof Error ? cause.message : "Mise à jour impossible" } }, { status: 503 });
  }
}
