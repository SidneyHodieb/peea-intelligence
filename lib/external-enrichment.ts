import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoreCandidate } from "./processing";
import { getSupabaseAdmin } from "./supabase-server";

// Offsets are mandatory; Date-only/local wall times must never become invented instants.
export const isoTimestamp = z.iso.datetime({ offset: true }).transform(value => new Date(value).toISOString());
const url = z.url().max(2048).refine(value => /^https?:\/\//i.test(value), "Une URL publique HTTP(S) est requise");
export const evidenceSchema = z.object({
  sourceName: z.string().min(2).max(160).default("Recherche externe"), sourceUrl: url,
  title: z.string().min(2).max(500).optional(), content: z.string().max(20_000).optional(),
  publishedAt: isoTimestamp.optional(), externalId: z.string().min(1).max(200).optional(),
  official: z.boolean().default(false),
}).strict();

// No defaults here: .partial() must not synthesize omitted PATCH fields (Zod 4).
export const eventCandidateSchema = z.object({
  externalId: z.string().min(1).max(200).optional(), title: z.string().min(3).max(500),
  description: z.string().max(20_000).optional(), startsAt: isoTimestamp.optional(), endsAt: isoTimestamp.optional(),
  city: z.string().min(1).max(160).optional(), region: z.string().max(160).optional(), country: z.string().max(120).optional(),
  venue: z.string().max(300).optional(), organizer: z.string().max(300).optional(), organizerWebsite: url.optional(),
  category: z.string().max(160).optional(), countries: z.array(z.string().max(100)).max(54).optional(),
  registrationUrl: url.optional(), relevance: z.number().int().min(0).max(100).optional(),
  verification: z.enum(["unverified", "corroborated", "contradictory"]).optional(),
  status: z.enum(["scheduled", "cancelled", "postponed", "excluded"]).optional(),
}).strict();
export const eventImportSchema = eventCandidateSchema.extend({ startsAt: isoTimestamp, city: z.string().min(1).max(160) })
  .refine(value => !value.endsAt || value.endsAt >= value.startsAt, { path: ["endsAt"], message: "La fin précède le début" });
export const eventPatchSchema = eventCandidateSchema.partial();
export const publicationSchema = z.object({
  title: z.string().min(3).max(500), content: z.string().min(1).max(20_000),
  publishedAt: isoTimestamp.optional(), eventId: z.uuid().optional(),
}).strict();
export type Evidence = z.infer<typeof evidenceSchema>;
export type EventCandidate = z.infer<typeof eventCandidateSchema>;

export class ExternalWriteError extends Error {
  readonly requestId = randomUUID();
  constructor(public code: string, public status: number) { super(code); }
}

export async function writeExternal(kind: "event" | "event_patch" | "publication" | "publication_patch", candidate: Record<string, unknown>, evidence: Evidence, targetId?: string, actor = "internal", dryRun = false) {
  // One RPC = one PostgreSQL transaction. Never fall back to partial REST writes.
  const { data, error } = await getSupabaseAdmin().rpc("peea_external_write", {
    p_kind: kind, p_candidate: candidate, p_evidence: evidence, p_target_id: targetId ?? null, p_actor: actor, p_dry_run: dryRun,
  });
  if (error) {
    const known: Record<string, [string, number]> = {
      P0002: ["NOT_FOUND", 404], "23503": ["INVALID_REFERENCE", 422], "23505": ["IDENTITY_CONFLICT", 409],
      "22023": ["VALIDATION_ERROR", 422], "42501": ["FORBIDDEN", 403], P0429: ["RATE_LIMITED", 429],
      P0004: ["SOURCE_MISMATCH", 409],
    };
    const [code, status] = known[error.code] ?? ["PERSISTENCE_ERROR", 503];
    const failure = new ExternalWriteError(code, status);
    console.error("external_write_failed", { requestId: failure.requestId, kind, targetId, code: error.code, message: error.message, details: error.details });
    throw failure;
  }
  return data;
}

export async function importEvent(candidate: EventCandidate | Partial<EventCandidate>, evidence: Evidence, existingEventId?: string, actor?: string, dryRun = false) {
  const classification = scoreCandidate({ title: candidate.title ?? "", description: candidate.description ?? "", city: candidate.city, future: candidate.startsAt ? new Date(candidate.startsAt) >= new Date() : false });
  // PATCH merges and preserves the score/data under a row lock inside PostgreSQL.
  const input = existingEventId ? candidate : { ...candidate, relevance: candidate.relevance ?? classification.score, scoreReasons: classification.reasons };
  return writeExternal(existingEventId ? "event_patch" : "event", input, evidence, existingEventId, actor, dryRun);
}

export async function importPublication(input: z.infer<typeof publicationSchema>, evidence: Evidence, targetId?: string, actor?: string, dryRun = false) {
  // Top-level title/content are the publication. Evidence can carry a different excerpt.
  return writeExternal(targetId ? "publication_patch" : "publication", input, {
    ...evidence, title: input.title, content: input.content, publishedAt: input.publishedAt ?? evidence.publishedAt,
  }, targetId, actor, dryRun);
}
