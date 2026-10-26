import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreCandidate } from "../../lib/processing";
import { buildPriorityQueries, getSourceCatalog, validateCatalog } from "../../lib/discovery-config";

const envSchema = z.object({ OPENAGENDA_API_KEY: z.string().optional(), BRAVE_SEARCH_API_KEY: z.string().optional(), DISCOVERY_USER_AGENT: z.string().default("PEEA-Intelligence-Hub/0.1") });
const env = envSchema.parse(process.env);

export async function collectRss(url: string) {
  const response = await fetch(url, { headers: { "user-agent": env.DISCOVERY_USER_AGENT }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`RSS indisponible (${response.status})`);
  const xml = await response.text();
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  const raw = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
  return (Array.isArray(raw) ? raw : [raw]).map((item: Record<string, unknown>) => {
    const link = typeof item.link === "object" && item.link !== null && "@_href" in item.link
      ? (item.link as Record<string, unknown>)["@_href"]
      : item.link;
    return { title: String(item.title ?? ""), link: String(link ?? ""), description: String(item.description ?? item.summary ?? "") };
  });
}

export function qualify(items: { title: string; description: string }[]) { return items.map(item => ({ ...item, ...scoreCandidate({ ...item, future: true }) })).filter(item => item.score >= 40); }

export type DiscoveredItem = {
  nativeId?: string; url: string; title: string; description: string; publishedAt?: string; source: string;
  startsAt?: string; endsAt?: string; city?: string; region?: string; country?: string; venue?: string;
  organizer?: string; organizerUrl?: string; registrationUrl?: string; keywords?: string[]; raw?: unknown;
};

export async function searchBrave(query: string, count = 20): Promise<DiscoveredItem[]> {
  if (!env.BRAVE_SEARCH_API_KEY) throw new Error("BRAVE_SEARCH_API_KEY absente");
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.search = new URLSearchParams({ q: query, count: String(Math.min(count, 20)), country: "FR", search_lang: "fr", ui_lang: "fr-FR", safesearch: "moderate", freshness: "pm" }).toString();
  const response = await fetch(url, { headers: { accept: "application/json", "x-subscription-token": env.BRAVE_SEARCH_API_KEY, "user-agent": env.DISCOVERY_USER_AGENT }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Brave Search indisponible (${response.status})`);
  const payload = await response.json() as { web?: { results?: Array<{ url: string; title: string; description?: string; age?: string }> } };
  return (payload.web?.results ?? []).map(item => ({ url: item.url, title: item.title, description: item.description ?? "", publishedAt: item.age, source: "brave" }));
}

export async function discoverOpenAgendaAgendas(search: string, size = 20) {
  if (!env.OPENAGENDA_API_KEY) throw new Error("OPENAGENDA_API_KEY absente");
  const url = new URL("https://api.openagenda.com/v2/agendas");
  url.search = new URLSearchParams({ search, size: String(Math.min(size, 100)), sort: "recentlyAddedEvents.desc" }).toString();
  const response = await fetch(url, { headers: { accept: "application/json", key: env.OPENAGENDA_API_KEY, "user-agent": env.DISCOVERY_USER_AGENT }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`OpenAgenda indisponible (${response.status})`);
  return response.json() as Promise<{ total: number; agendas: Array<{ uid: number; title: string; slug: string; description?: string }> }>;
}

export async function collectOpenAgendaEvents(agendaUid: number, search?: string): Promise<DiscoveredItem[]> {
  if (!env.OPENAGENDA_API_KEY) throw new Error("OPENAGENDA_API_KEY absente");
  const url = new URL(`https://api.openagenda.com/v2/agendas/${agendaUid}/events`);
  const params = new URLSearchParams({ size: "100", monolingual: "fr", detailed: "1" });
  params.append("relative[]", "current"); params.append("relative[]", "upcoming");
  if (search) { params.set("search", search); params.set("threshold", "auto"); }
  url.search = params.toString();
  const response = await fetch(url, { headers: { accept: "application/json", key: env.OPENAGENDA_API_KEY, "user-agent": env.DISCOVERY_USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Événements OpenAgenda indisponibles (${response.status})`);
  const payload = await response.json() as { events?: Array<{
    uid: number; title?: { fr?: string } | string; description?: { fr?: string } | string; longDescription?: { fr?: string } | string;
    canonicalUrl?: string; updatedAt?: string; keywords?: string[]; country?: string;
    firstTiming?: { begin?: string; end?: string }; nextTiming?: { begin?: string; end?: string };
    location?: { city?: string; region?: string; name?: string; address?: string; countryCode?: string };
    originAgenda?: { title?: string; url?: string }; registration?: Array<{ type?: string; value?: string }>;
  }> };
  const localized = (value: { fr?: string } | string | undefined) => typeof value === "string" ? value : value?.fr ?? "";
  return (payload.events ?? []).map(item => {
    const timing = item.nextTiming ?? item.firstTiming;
    const registrationLink = item.registration?.find(entry => entry.type === "link" || entry.type === "url")?.value;
    return {
      nativeId: String(item.uid), url: item.canonicalUrl ?? `https://openagenda.com/event/${item.uid}`,
      title: localized(item.title), description: localized(item.longDescription) || localized(item.description),
      publishedAt: item.updatedAt, source: "openagenda", startsAt: timing?.begin, endsAt: timing?.end,
      city: item.location?.city, region: item.location?.region, country: item.country,
      venue: [item.location?.name, item.location?.address].filter(Boolean).join(" — "),
      organizer: item.originAgenda?.title, organizerUrl: item.originAgenda?.url,
      registrationUrl: registrationLink ?? item.canonicalUrl, keywords: item.keywords ?? [], raw: item,
    };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const validation = validateCatalog();
  console.log(JSON.stringify({ status: validation.valid ? "ready" : "invalid_catalog", connectors: { rss: true, openagenda: Boolean(env.OPENAGENDA_API_KEY), brave: Boolean(env.BRAVE_SEARCH_API_KEY) }, catalog: validation, plannedQueries: buildPriorityQueries().length, rssSources: getSourceCatalog().filter(source => source.type === "rss").length }, null, 2));
}
