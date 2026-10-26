import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const db = new PGlite({ extensions: { pgcrypto } });
const event = { title: "Forum Afrique — investissement", description: "Description à conserver", startsAt: "2027-11-10T13:30:00.000Z", city: "Paris", organizer: "Organisateur A", countries: ["Sénégal"], relevance: 85, scoreReasons: ["Afrique"] };
const proof = { sourceName: "Organisateur", sourceUrl: "https://organisateur.example/forum", title: "Annonce", content: "Preuve publique", official: true };
async function write(kind: string, candidate: object, evidence: object, id: string | null = null, dryRun = false, actor = "tests") {
  const { rows } = await db.query<{ result: any }>("select public.peea_external_write($1,$2,$3,$4,$5,$6) as result", [kind, JSON.stringify(candidate), JSON.stringify(evidence), id, actor, dryRun]);
  return rows[0].result;
}
async function count(table: string) { return Number((await db.query<{ n: number }>(`select count(*) as n from ${table}`)).rows[0].n); }

beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(await readFile("supabase/migrations/202610260001_initial_schema.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/202610260002_external_atomic_writes.sql", "utf8"));
}, 30_000);
afterAll(async () => { await db.close(); });

describe("real PostgreSQL external write transaction", () => {
  it("validates a dry run with no persisted domain rows", async () => {
    expect(await write("event", event, proof, null, true)).toMatchObject({ valid: true, dry_run: true, created: true });
    for (const table of ["sources", "source_items", "source_versions", "publications", "events", "event_mentions", "audit_logs", "external_write_limits", "external_write_receipts"]) expect(await count(table)).toBe(0);
  });
  it("commits a complete event and returns its persisted data", async () => {
    const result = await write("event", event, proof);
    expect(result).toMatchObject({ action: "created", event: { title: event.title, verification: "unverified", data: { description: event.description } } });
    expect(await count("event_mentions")).toBe(1); expect(await count("audit_logs")).toBe(1);
    expect((await db.query("select summary from publications")).rows[0]).toMatchObject({ summary: proof.content });
  });
  it("replays the same payload without duplicate events, versions or changes", async () => {
    const first = await write("event", event, proof);
    const replay = await write("event", event, proof);
    expect(replay.id).toBe(first.id); expect(replay.action).toBe("duplicate");
    expect(await count("events")).toBe(1); expect(await count("source_versions")).toBe(1); expect(await count("event_changes")).toBe(0);
  });
  it("keeps absent PATCH fields, the official status and unknown data", async () => {
    const original = await write("event", event, proof);
    await db.query("update events set verification = 'official', data = data || '{\"custom\":\"keep\"}'::jsonb where id = $1", [original.id]);
    const result = await write("event_patch", { venue: "Lieu confirmé" }, { ...proof, sourceUrl: "https://organisateur.example/venue" }, original.id);
    expect(result.event).toMatchObject({ verification: "official", relevance: 85, data: { description: event.description, countries: ["Sénégal"], custom: "keep", venue: "Lieu confirmé", startsAt: event.startsAt } });
    expect(await count("events")).toBe(1);
  });
  it("does not recreate an old event when its original payload is retried after rescheduling", async () => {
    const input = { ...event, title: "Forum replanifié" };
    const evidence = { ...proof, sourceUrl: "https://example.org/rescheduled" };
    const created = await write("event", input, evidence);
    await write("event_patch", { startsAt: "2027-12-01T10:00:00.000Z" }, evidence, created.id);
    const replay = await write("event", input, evidence);
    expect(replay.id).toBe(created.id); expect(replay.action).toBe("duplicate");
    expect(replay.event.data.startsAt).toBe("2027-12-01T10:00:00.000Z");
  });
  it("does not let an external writer assign official", async () => {
    await expect(write("event", { ...event, verification: "official" }, proof)).rejects.toThrow("Invalid external verification");
  });
  it("rolls back event, proof, publication and audit together on a late failure", async () => {
    const before = await count("events"); const sources = await count("sources");
    await db.exec("create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'forced audit failure'; end $$; create trigger reject_audit before insert on audit_logs for each row execute function fail_audit();");
    try { await expect(write("event", { ...event, title: "Événement transaction annulée" }, { ...proof, sourceName: "Rollback", sourceUrl: "https://example.org/rollback" })).rejects.toThrow("forced audit failure"); }
    finally { await db.exec("drop trigger reject_audit on audit_logs; drop function fail_audit();"); }
    expect(await count("events")).toBe(before); expect(await count("sources")).toBe(sources);
    expect((await db.query("select * from source_items where canonical_url = 'https://example.org/rollback'")).rows).toHaveLength(0);
  });
  it("keeps publication content and updates the same ID in place", async () => {
    const input = { title: "Annonce publique", content: "Résumé factuel", publishedAt: "2026-10-20T08:00:00Z" };
    const evidence = { sourceName: "Institution", sourceUrl: "https://example.org/post" };
    const created = await write("publication", input, evidence);
    expect(created.publication.summary).toBe(input.content);
    const repaired = await write("publication_patch", { ...input, content: "Résumé corrigé" }, evidence, created.id);
    expect(repaired.id).toBe(created.id); expect(repaired.publication.summary).toBe("Résumé corrigé");
    const replay = await write("publication", { ...input, content: "Résumé corrigé" }, evidence);
    expect(replay.action).toBe("duplicate");
    await expect(write("publication_patch", input, { ...evidence, sourceUrl: "https://example.org/other" }, created.id)).rejects.toThrow("Publication source mismatch");
  });
  it("validates unknown target/event IDs before persisting a source", async () => {
    const before = await count("source_items");
    await expect(write("publication", { title: "Annonce liée", content: "Texte", eventId: randomUUID() }, { ...proof, sourceUrl: "https://example.org/missing" })).rejects.toThrow("Invalid eventId");
    await expect(write("event_patch", { venue: "Lieu" }, proof, randomUUID())).rejects.toThrow("Event not found");
    expect(await count("source_items")).toBe(before);
  });
  it("does not merge identical title/date/city from different organizers", async () => {
    const result = await write("event", { ...event, organizer: "Autre organisateur" }, { ...proof, sourceUrl: "https://other.example/event" });
    expect(result.action).toBe("created");
  });
  it("reconciles a compatible legacy identity without duplicating it", async () => {
    const id = randomUUID();
    await db.query("insert into events(id,identity_key,title,data) values($1,'forum ancien|2027-11-10|paris','Forum ancien',$2)", [id, JSON.stringify({ ...event, title: undefined })]);
    const result = await write("event", { ...event, title: "Forum ancien" }, { ...proof, sourceUrl: "https://example.org/legacy" });
    expect(result.id).toBe(id); expect(result.created).toBe(false);
  });
  it("rejects past creates, inverted ranges and repeated flood writes", async () => {
    await expect(write("event", { ...event, startsAt: "2020-01-01T00:00:00Z" }, proof)).rejects.toThrow("future events");
    await expect(write("event", { ...event, endsAt: "2027-01-01T00:00:00Z" }, proof)).rejects.toThrow("ends before");
    await db.exec("insert into external_write_limits values ('limited',date_trunc('minute',now()),120);");
    await expect(write("event", event, proof, null, false, "limited")).rejects.toThrow("Write rate exceeded");
  });
  it("does not grant public clients access to the writer", async () => {
    const { rows } = await db.query<{ allowed: boolean }>("select has_function_privilege('anon','public.peea_external_write(text,jsonb,jsonb,uuid,text,boolean)','execute') as allowed");
    expect(rows[0].allowed).toBe(false);
  });
});

it("keeps native and external semantic identities aligned across midnight and DST", async () => {
  const { economicEventIdentity } = await import("../lib/processing");
  for (const startsAt of ["2027-07-10T22:30:00Z", "2027-11-10T23:30:00Z"]) {
    const candidate = { ...event, title: "Économie et Sénégal", startsAt };
    const result = await db.query<{ identity: string }>("select public.peea_event_identity($1) as identity", [JSON.stringify(candidate)]);
    expect(result.rows[0].identity).toBe(economicEventIdentity(candidate).key);
  }
});
