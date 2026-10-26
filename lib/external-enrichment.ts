import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { normalizeTitle, scoreCandidate } from "./processing";
import { getSupabaseAdmin } from "./supabase-server";

const timestamp = z.iso.datetime().optional();
const url = z.url().max(2048);

export const evidenceSchema = z.object({
  sourceName: z.string().min(2).max(160).default("Recherche externe"),
  sourceUrl: url,
  title: z.string().min(2).max(500).optional(),
  content: z.string().max(20_000).default(""),
  publishedAt: timestamp,
  externalId: z.string().min(1).max(200).optional(),
  official: z.boolean().default(false),
});

export const eventCandidateSchema = z.object({
  externalId: z.string().min(1).max(200).optional(),
  title: z.string().min(3).max(500),
  description: z.string().max(20_000).default(""),
  startsAt: timestamp,
  endsAt: timestamp,
  city: z.string().max(160).optional(),
  region: z.string().max(160).optional(),
  country: z.string().max(120).optional(),
  venue: z.string().max(300).optional(),
  organizer: z.string().max(300).optional(),
  organizerWebsite: url.optional(),
  category: z.string().max(160).optional(),
  countries: z.array(z.string().max(100)).max(54).default([]),
  registrationUrl: url.optional(),
  relevance: z.number().int().min(0).max(100).optional(),
  verification: z.enum(["unverified", "corroborated", "contradictory"]).optional(),
  status: z.enum(["scheduled", "cancelled", "postponed", "excluded"]).optional(),
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type EventCandidate = z.infer<typeof eventCandidateSchema>;

function validTimestamp(value?: string) {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

async function ensureSource(evidence: Evidence) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: readError } = await supabase.from("sources").select("id").eq("name", evidence.sourceName).maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.id as string;
  const { data, error } = await supabase.from("sources").insert({
    id: randomUUID(), name: evidence.sourceName, kind: "html", config: { base_url: evidence.sourceUrl, connector: "external" },
    enabled: true, official: evidence.official, public_analysis: true, retain_content: true,
    access_method: "public_html", restrictions: "Contenu public transmis avec preuve d’origine", frequency_minutes: 1440,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function persistEvidence(evidence: Evidence) {
  const supabase = getSupabaseAdmin();
  const sourceId = await ensureSource(evidence);
  const nativeId = evidence.externalId ?? createHash("sha256").update(evidence.sourceUrl).digest("hex").slice(0, 32);
  let { data: item, error: itemError } = await supabase.from("source_items").select("id,current_version").eq("source_id", sourceId).eq("native_id", nativeId).maybeSingle();
  if (itemError) throw itemError;
  if (!item) {
    const byUrl = await supabase.from("source_items").select("id,current_version").eq("canonical_url", evidence.sourceUrl).maybeSingle();
    if (byUrl.error) throw byUrl.error;
    item = byUrl.data;
  }
  if (!item) {
    const created = await supabase.from("source_items").insert({ id: randomUUID(), source_id: sourceId, native_id: nativeId, canonical_url: evidence.sourceUrl, current_version: 1 }).select("id,current_version").single();
    if (created.error) throw created.error;
    item = created.data;
  } else {
    const touched = await supabase.from("source_items").update({ last_seen_at: new Date().toISOString(), canonical_url: evidence.sourceUrl }).eq("id", item.id);
    if (touched.error) throw touched.error;
  }

  const content = evidence.content || evidence.title || evidence.sourceUrl;
  const contentHash = createHash("sha256").update(`${evidence.title ?? ""}\n${content}`).digest("hex");
  const latest = await supabase.from("source_versions").select("id,version,content_hash").eq("item_id", item.id).order("version", { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw latest.error;
  if (latest.data?.content_hash === contentHash) return { itemId: item.id as string, versionId: latest.data.id as string };

  const version = (latest.data?.version ?? 0) + 1;
  const created = await supabase.from("source_versions").insert({
    id: randomUUID(), item_id: item.id, version, title: evidence.title ?? "Information externe", content, content_hash: contentHash,
    published_at: validTimestamp(evidence.publishedAt), access_level: "metadata", rights: { source_url: evidence.sourceUrl },
    structured: { external: true, official: evidence.official }, state: "processed", attempts: 1,
    processing_outcome: "accepted", processing_details: { connector: "external" }, processed_at: new Date().toISOString(),
  }).select("id").single();
  if (created.error) throw created.error;
  await supabase.from("source_items").update({ current_version: version }).eq("id", item.id);
  return { itemId: item.id as string, versionId: created.data.id as string };
}

async function ensurePublication(itemId: string, evidence: Evidence) {
  const supabase = getSupabaseAdmin();
  const current = await supabase.from("publications").select("id").eq("item_id", itemId).maybeSingle();
  if (current.error) throw current.error;
  if (current.data) return current.data.id as string;
  const created = await supabase.from("publications").insert({
    id: randomUUID(), item_id: itemId, platform: evidence.sourceName, summary: evidence.content.slice(0, 1000), published_at: validTimestamp(evidence.publishedAt),
  }).select("id").single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

async function ensureOrganization(name?: string, website?: string) {
  if (!name) return undefined;
  const supabase = getSupabaseAdmin();
  const identityKey = normalizeTitle(name);
  const current = await supabase.from("organizations").select("id").eq("identity_key", identityKey).maybeSingle();
  if (current.error) throw current.error;
  if (current.data) return current.data.id as string;
  const created = await supabase.from("organizations").insert({ id: randomUUID(), name, identity_key: identityKey, website: website ?? null }).select("id").single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

export async function audit(action: string, entityId: string, details: Record<string, unknown>) {
  const result = await getSupabaseAdmin().from("audit_logs").insert({ action, entity_id: entityId, details });
  if (result.error) throw result.error;
}

export async function importEvent(candidate: EventCandidate, evidence: Evidence, existingEventId?: string) {
  const supabase = getSupabaseAdmin();
  const proof = await persistEvidence({ ...evidence, title: evidence.title ?? candidate.title, content: evidence.content || candidate.description });
  const publicationId = await ensurePublication(proof.itemId, evidence);
  const organizationId = await ensureOrganization(candidate.organizer, candidate.organizerWebsite);
  const deterministic = scoreCandidate({ title: candidate.title, description: candidate.description, city: candidate.city, future: candidate.startsAt ? new Date(candidate.startsAt) >= new Date() : false });
  const relevance = candidate.relevance ?? deterministic.score;
  const identityKey = candidate.externalId
    ? `external|${candidate.externalId}`
    : `${normalizeTitle(candidate.title)}|${candidate.startsAt?.slice(0, 10) ?? "undated"}|${normalizeTitle(candidate.city ?? "online")}`;
  const data = {
    startsAt: candidate.startsAt, endsAt: candidate.endsAt, city: candidate.city, region: candidate.region,
    country: candidate.country ?? "France", venue: candidate.venue, organizer: candidate.organizer,
    organizerId: organizationId, category: candidate.category ?? "Économie & diaspora", description: candidate.description,
    countries: candidate.countries, registrationUrl: candidate.registrationUrl ?? evidence.sourceUrl,
    sourceUrl: evidence.sourceUrl, scoreReasons: candidate.relevance === undefined ? deterministic.reasons : ["Score fourni par enrichissement externe"],
  };
  let before: Record<string, unknown> | null = null;
  let eventId = existingEventId;
  if (eventId) {
    const current = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) throw new Error("Événement introuvable");
    before = current.data as Record<string, unknown>;
  } else {
    const current = await supabase.from("events").select("id,*").eq("identity_key", identityKey).maybeSingle();
    if (current.error) throw current.error;
    if (current.data) { eventId = current.data.id as string; before = current.data as Record<string, unknown>; }
  }
  const values = { identity_key: identityKey, title: candidate.title, data, relevance, verification: candidate.verification ?? "unverified", status: candidate.status ?? "scheduled", is_demo: false, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const result = eventId
    ? await supabase.from("events").update(values).eq("id", eventId).select("id").single()
    : await supabase.from("events").insert({ id: randomUUID(), ...values }).select("id").single();
  if (result.error) throw result.error;
  eventId = result.data.id as string;
  const mention = await supabase.from("event_mentions").upsert({ event_id: eventId, publication_id: publicationId, version_id: proof.versionId }, { onConflict: "event_id,publication_id,version_id" });
  if (mention.error) throw mention.error;
  if (before) {
    const change = await supabase.from("event_changes").insert({ id: randomUUID(), event_id: eventId, version_id: proof.versionId, kind: "external_enrichment", before_data: before, after_data: values });
    if (change.error) throw change.error;
  }
  await audit(before ? "event.enriched" : "event.imported", eventId, { source_url: evidence.sourceUrl, source_name: evidence.sourceName, version_id: proof.versionId });
  return { id: eventId, created: !before, relevance, verification: values.verification };
}

export async function importPublication(input: { title: string; content: string; publishedAt?: string; eventId?: string }, evidence: Evidence) {
  const proof = await persistEvidence({ ...evidence, title: evidence.title ?? input.title, content: evidence.content || input.content, publishedAt: evidence.publishedAt ?? input.publishedAt });
  const publicationId = await ensurePublication(proof.itemId, evidence);
  if (input.eventId) {
    const link = await getSupabaseAdmin().from("event_mentions").upsert({ event_id: input.eventId, publication_id: publicationId, version_id: proof.versionId }, { onConflict: "event_id,publication_id,version_id" });
    if (link.error) throw link.error;
  }
  await audit("publication.imported", publicationId, { source_url: evidence.sourceUrl, event_id: input.eventId ?? null, version_id: proof.versionId });
  return { id: publicationId };
}
