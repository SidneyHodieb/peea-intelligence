// Unknown source metadata stays unknown; discovery time is a separate fact.
export function mapPublicationRow(row: Record<string, any>) {
  const item = row.source_items;
  const version = [...(item?.source_versions ?? [])].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
  const mentions = row.event_mentions as Array<{ event_id: string }> | undefined;
  return {
    id: String(row.id), source: item?.sources?.name ?? "Source web", sourceUrl: item?.canonical_url,
    author: row.people?.name ?? "Auteur non renseigné",
    organization: String(version?.structured?.organizer ?? item?.sources?.name ?? "Source à qualifier"),
    publishedAt: row.published_at ?? version?.published_at ?? null,
    discoveredAt: item?.discovered_at ?? null,
    title: version?.title ?? "Publication sans titre",
    excerpt: row.summary?.trim() ? row.summary : (version?.content?.slice(0, 1000) ?? ""),
    eventId: mentions?.[0]?.event_id ?? "", eventIds: [...new Set((mentions ?? []).map(value => value.event_id))],
    quality: row.platform === "openagenda" ? "Source officielle" as const : "À vérifier" as const,
  };
}
