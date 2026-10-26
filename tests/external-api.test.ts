import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eventPatchSchema, eventImportSchema } from "../lib/external-enrichment";
import { mapPublicationRow } from "../lib/publication-mapping";
import { POST as eventsPost } from "../app/api/v1/internal/external/events/route";
import { PATCH as eventPatch } from "../app/api/v1/internal/external/events/[id]/route";
import { POST as publicationPost } from "../app/api/v1/internal/external/publications/route";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../lib/supabase-server", () => ({ getSupabaseAdmin: () => ({ rpc }) }));
const evidence = { sourceName: "Organisateur", sourceUrl: "https://example.org/forum" };
const event = { title: "Forum Afrique", description: "Investissement", startsAt: "2027-11-10T14:30:00+01:00", city: "Paris" };
function request(body: unknown, authorization = "Bearer test-token") { return new NextRequest("https://example.org/api", { method: "POST", headers: { "content-type": "application/json", authorization }, body: typeof body === "string" ? body : JSON.stringify(body) }); }
beforeEach(() => { vi.stubEnv("EXTERNAL_API_TOKEN", "test-token"); rpc.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("external route regressions", () => {
  it("accepts UTC and explicit offsets, rejects timezone-less and unknown times", () => {
    expect(eventImportSchema.parse(event).startsAt).toBe("2027-11-10T13:30:00.000Z");
    expect(eventImportSchema.parse({ ...event, startsAt: "2027-07-10T09:00:00+02:00" }).startsAt).toBe("2027-07-10T07:00:00.000Z");
    for (const startsAt of ["2027-11-10", "2027-11-10T14:30:00", "2027-02-30T09:00:00Z"]) expect(eventImportSchema.safeParse({ ...event, startsAt }).success).toBe(false);
    expect(eventImportSchema.safeParse({ ...event, startsAt: undefined }).success).toBe(false);
  });
  it("does not materialize omitted fields in PATCH and rejects null", () => {
    expect(eventPatchSchema.parse({ verification: "corroborated" })).toEqual({ verification: "corroborated" });
    expect(eventPatchSchema.safeParse({ description: null }).success).toBe(false);
  });
  it("rejects anonymous and unconfigured writes before touching the DB", async () => {
    expect((await eventsPost(request({}, ""))).status).toBe(401);
    vi.stubEnv("EXTERNAL_API_TOKEN", ""); vi.stubEnv("INTERNAL_API_TOKEN", "");
    expect((await publicationPost(request({}))).status).toBe(503); expect(rpc).not.toHaveBeenCalled();
  });
  it("returns a stable 400 for malformed JSON and rejects >50 records", async () => {
    expect((await eventsPost(request("{"))).status).toBe(400);
    expect((await eventsPost(request({ records: Array.from({ length: 51 }, () => ({ event, evidence })) }))).status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("runs a transactional dry run, reports failures without pretending success", async () => {
    rpc.mockResolvedValueOnce({ data: { valid: true, dry_run: true }, error: null });
    const response = await eventsPost(request({ dryRun: true, records: [{ event, evidence }] }));
    expect(response.status).toBe(200); expect(rpc.mock.calls[0][1]).toMatchObject({ p_dry_run: true, p_candidate: { startsAt: "2027-11-10T13:30:00.000Z" } });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "private database details" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = await eventsPost(request({ records: [{ event, evidence }] }));
    expect(failed.status).toBe(207); expect(await failed.json()).toMatchObject({ data: { succeeded: 0, failed: 1, results: [{ error: "IDENTITY_CONFLICT" }] } });
  });
  it("sends only the requested PATCH fields to the transaction", async () => {
    rpc.mockResolvedValue({ data: { id: "test", action: "updated", event: { data: { description: "conservée" } } }, error: null });
    const response = await eventPatch(request({ patch: { verification: "corroborated" }, evidence }), { params: Promise.resolve({ id: "c9c37b27-1eef-4943-a12c-cd9455159c43" }) });
    expect(response.status).toBe(200); expect(rpc.mock.calls[0][1].p_candidate).toEqual({ verification: "corroborated" });
  });
  it("propagates publication content without requiring evidence.content", async () => {
    rpc.mockResolvedValue({ data: { id: "test", action: "created" }, error: null });
    expect((await publicationPost(request({ title: "Titre officiel", content: "Résumé reçu", evidence }))).status).toBe(201);
    expect(rpc.mock.calls[0][1].p_evidence).toMatchObject({ title: "Titre officiel", content: "Résumé reçu" });
  });
  it("renders an empty legacy summary from source content without fabricating metadata", () => {
    const result = mapPublicationRow({ id: "existing", summary: "", published_at: null, source_items: { canonical_url: evidence.sourceUrl, discovered_at: "2026-10-26T12:00:00Z", source_versions: [{ version: 1, title: "Titre", content: "Résumé vérifié" }] } });
    expect(result).toMatchObject({ id: "existing", excerpt: "Résumé vérifié", author: "Auteur non renseigné", publishedAt: null, discoveredAt: "2026-10-26T12:00:00Z" });
  });
});
