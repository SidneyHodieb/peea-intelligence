import { createHash, randomUUID } from "node:crypto";
import { normalizeTitle, scoreCandidate, economicEventIdentity } from "../../lib/processing";
import { getSupabaseAdmin } from "../../lib/supabase-server";
import { buildPriorityQueries, getSourceCatalog } from "../../lib/discovery-config";
import { collectOpenAgendaEvents, collectRss, discoverOpenAgendaAgendas, searchBrave, type DiscoveredItem } from "./run";

const supabase = getSupabaseAdmin();
const runAt = new Date().toISOString();
const errorMessage = (error: unknown) => error instanceof Error ? error.message : typeof error === "object" ? JSON.stringify(error) : String(error);
const validTimestamp = (value?: string) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;

async function ensureSource(name: string, kind: string, baseUrl: string, official = false) {
  const { data: existing, error: readError } = await supabase.from("sources").select("id").eq("name", name).maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.id as string;
  const { data, error } = await supabase.from("sources").insert({
    id: randomUUID(), name, kind: "html", config: { base_url: baseUrl, connector: kind }, enabled: true, official, public_analysis: true,
    retain_content: true, access_method: "public_html", restrictions: "Collecte de contenus publics uniquement", frequency_minutes: 180,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function persistVersion(sourceId: string, item: DiscoveredItem) {
  const nativeId = item.nativeId ?? createHash("sha256").update(item.url).digest("hex").slice(0, 32);
  let { data: sourceItem, error: itemReadError } = await supabase.from("source_items").select("id,current_version").eq("source_id", sourceId).eq("native_id", nativeId).maybeSingle();
  if (itemReadError) throw itemReadError;
  if (!sourceItem) {
    const canonical = await supabase.from("source_items").select("id,current_version").eq("canonical_url", item.url).maybeSingle();
    if (canonical.error) throw canonical.error;
    sourceItem = canonical.data;
  }
  if (!sourceItem) {
    const inserted = await supabase.from("source_items").insert({ id: randomUUID(), source_id: sourceId, native_id: nativeId, canonical_url: item.url, current_version: 1, last_seen_at: runAt }).select("id,current_version").single();
    if (inserted.error) throw inserted.error;
    sourceItem = inserted.data;
  } else {
    const updated = await supabase.from("source_items").update({ canonical_url: item.url, last_seen_at: runAt }).eq("id", sourceItem.id);
    if (updated.error) throw updated.error;
  }
  const contentHash = createHash("sha256").update(`${item.title}\n${item.description}`).digest("hex");
  const { data: latest, error: versionReadError } = await supabase.from("source_versions").select("id,version,content_hash").eq("item_id", sourceItem.id).order("version", { ascending: false }).limit(1).maybeSingle();
  if (versionReadError) throw versionReadError;
  if (latest?.content_hash === contentHash) return { itemId: sourceItem.id as string, versionId: latest.id as string };
  const version = (latest?.version ?? 0) + 1;
  const { data: created, error: versionError } = await supabase.from("source_versions").insert({
    id: randomUUID(), item_id: sourceItem.id, version, title: item.title, content: item.description, content_hash: contentHash,
    published_at: validTimestamp(item.publishedAt), access_level: "metadata", rights: { source_url: item.url },
    structured: item.raw ?? item, state: "processed", attempts: 1, processing_outcome: "accepted",
    processing_details: { collector: item.source }, processed_at: runAt,
  }).select("id").single();
  if (versionError) throw versionError;
  await supabase.from("source_items").update({ current_version: version }).eq("id", sourceItem.id);
  return { itemId: sourceItem.id as string, versionId: created.id as string };
}

async function ensureOrganization(name: string, website?: string) {
  const identityKey = normalizeTitle(name);
  const { data: existing, error: readError } = await supabase.from("organizations").select("id").eq("identity_key", identityKey).maybeSingle();
  if (readError) throw readError;
  if (existing) { await supabase.from("organizations").update({ name, website: website ?? null }).eq("id", existing.id); return existing.id as string; }
  const { data, error } = await supabase.from("organizations").insert({ id: randomUUID(), name, identity_key: identityKey, website: website ?? null }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function ensurePublication(itemId: string, item: DiscoveredItem) {
  const { data: existing, error: readError } = await supabase.from("publications").select("id").eq("item_id", itemId).maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.id as string;
  const { data, error } = await supabase.from("publications").insert({ id: randomUUID(), item_id: itemId, platform: item.source, summary: item.description.slice(0, 1000), published_at: validTimestamp(item.publishedAt) ?? runAt }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function persistPublication(sourceId: string, item: DiscoveredItem) {
  const version = await persistVersion(sourceId, item);
  await ensurePublication(version.itemId, item);
}

async function persistEvent(sourceId: string, item: DiscoveredItem) {
  if (!item.startsAt || !item.title) return false;
  const future = new Date(item.startsAt) >= new Date();
  const classification = scoreCandidate({ title: item.title, description: item.description, city: item.city, future });
  const identity = economicEventIdentity({ title: item.title, startsAt: item.startsAt, city: item.city, organizer: item.organizer });
  const identityKey = identity.key;
  if (!future || classification.score < 40) {
    await supabase.from("events").update({ status: "excluded", relevance: classification.score, updated_at: runAt }).eq("identity_key", identityKey);
    return false;
  }
  const organizationId = item.organizer ? await ensureOrganization(item.organizer, item.organizerUrl) : undefined;
  const version = await persistVersion(sourceId, item);
  const publicationId = await ensurePublication(version.itemId, item);
  const eventData = {
    startsAt: item.startsAt, endsAt: item.endsAt, city: item.city, region: item.region, country: item.country ?? "France",
    venue: item.venue, organizer: item.organizer, organizerId: organizationId, category: item.keywords?.[0] ?? "Économie & diaspora",
    description: item.description, registrationUrl: item.registrationUrl ?? item.url, sourceUrl: item.url,
    scoreReasons: classification.reasons, countries: item.keywords?.filter(value => /bénin|sénégal|cameroun|maroc|mali|guinée|gabon|ghana|nigeria|congo|tunisie|algérie|togo|rwanda|kenya|afrique/i.test(value)) ?? [],
  };
  const { data: matches, error: eventReadError } = await supabase.from("events").select("id,data,identity_key").in("identity_key", [identityKey, identity.legacy]);
  if (eventReadError) throw eventReadError;
  const existingEvent = matches?.find(row => row.identity_key === identityKey) ?? matches?.find(row => normalizeTitle(row.data?.organizer ?? "") === normalizeTitle(item.organizer ?? ""));
  const eventValues = { identity_key: identityKey, title: item.title, data: eventData, relevance: classification.score, verification: "official", status: "scheduled", is_demo: false, last_verified_at: runAt, updated_at: runAt };
  const { data: event, error } = existingEvent
    ? await supabase.from("events").update(eventValues).eq("id", existingEvent.id).select("id").single()
    : await supabase.from("events").insert({ id: randomUUID(), ...eventValues }).select("id").single();
  if (error) throw error;
  const mention = await supabase.from("event_mentions").upsert({ event_id: event.id, publication_id: publicationId, version_id: version.versionId }, { onConflict: "event_id,publication_id,version_id" });
  if (mention.error) throw mention.error;
  if (organizationId) {
    const { data: existing } = await supabase.from("partnership_opportunities").select("id").eq("organization_id", organizationId).eq("event_id", event.id).maybeSingle();
    if (!existing) {
      const opportunity = await supabase.from("partnership_opportunities").insert({ id: randomUUID(), organization_id: organizationId, event_id: event.id, evidence: item.url, suggestion: "Évaluer un partenariat autour de cet événement", status: "identified", notes: "" });
      if (opportunity.error) throw opportunity.error;
    }
  }
  return true;
}

async function run() {
  const openAgendaSource = await ensureSource("OpenAgenda API v2", "api", "https://api.openagenda.com/v2", true);
  const braveSource = await ensureSource("Brave Search", "search", "https://api.search.brave.com");
  let found = 0, retained = 0, failed = 0;
  const agendas = new Map<number, { uid: number }>();
  for (const search of ["Afrique diaspora", "Afrique investissement", "Afrique entrepreneuriat", "Africa business", "diaspora africaine"]) {
    try { for (const agenda of (await discoverOpenAgendaAgendas(search, 20)).agendas) agendas.set(agenda.uid, agenda); }
    catch (error) { failed++; console.error(`OpenAgenda agendas: ${errorMessage(error)}`); }
  }
  for (const agenda of [...agendas.values()].slice(0, 60)) {
    try { const items = await collectOpenAgendaEvents(agenda.uid); found += items.length; for (const item of items) if (await persistEvent(openAgendaSource, item)) retained++; }
    catch (error) { failed++; console.error(`OpenAgenda ${agenda.uid}: ${errorMessage(error)}`); }
  }
  for (const query of buildPriorityQueries().slice(0, 12)) {
    try { const items = await searchBrave(query, 10); found += items.length; for (const item of items) { const result = scoreCandidate({ title: item.title, description: item.description, future: true }); if (result.score >= 40) { await persistPublication(braveSource, item); retained++; } } }
    catch (error) { failed++; console.error(`Brave: ${errorMessage(error)}`); }
  }
  for (const source of getSourceCatalog().filter(entry => entry.type === "rss")) {
    try {
      const sourceId = await ensureSource(source.name, "rss", source.url);
      const items = (await collectRss(source.url)).slice(0, 25); found += items.length;
      for (const raw of items) { const item: DiscoveredItem = { title: raw.title, description: raw.description, url: raw.link, source: source.name }; const result = scoreCandidate({ title: item.title, description: item.description, future: true }); if (item.url && result.score >= 40) { await persistPublication(sourceId, item); retained++; } }
    } catch (error) { failed++; console.error(`RSS ${source.name}: ${errorMessage(error)}`); }
  }
  await supabase.from("sources").update({ last_success: runAt, discovered: found, last_error: failed ? `${failed} source(s) en erreur` : null }).in("id", [openAgendaSource, braveSource]);
  console.log(JSON.stringify({ status: failed ? "partial" : "succeeded", agendas: agendas.size, found, retained, failed }, null, 2));
}

run().catch(error => { console.error(error); process.exitCode = 1; });
