import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase serveur incomplète");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const verificationLabels = {
  official: "Source officielle",
  corroborated: "Corroboré",
  to_verify: "À vérifier",
  unverified: "À vérifier",
  contradictory: "Contradictoire",
} as const;

export const stageLabels = {
  discovered: "Découvert",
  to_qualify: "À qualifier",
  qualified: "Qualifié",
  to_contact: "À contacter",
  contacted: "Contacté",
  discussing: "En discussion",
  partner: "Partenaire",
  rejected: "Découvert",
} as const;

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "—";
}

export function mapEventRow(row: Record<string, unknown>) {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id), title: String(row.title), date: String(data.startsAt ?? row.created_at),
    endDate: data.endsAt ? String(data.endsAt) : undefined, city: String(data.city ?? "En ligne"),
    region: String(data.region ?? ""), venue: String(data.venue ?? (data.city ? "À confirmer" : "En ligne")),
    organizer: String(data.organizer ?? "Organisateur à confirmer"), category: String(data.category ?? "Économie & diaspora"),
    score: Number(row.relevance ?? 0),
    verification: verificationLabels[String(row.verification) as keyof typeof verificationLabels] ?? "À vérifier",
    countries: Array.isArray(data.countries) ? data.countries.map(String) : [], description: String(data.description ?? ""),
    sourceCount: 1, registrationUrl: data.registrationUrl ? String(data.registrationUrl) : undefined,
    updatedAt: String(row.updated_at), scoreReasons: Array.isArray(data.scoreReasons) ? data.scoreReasons.map(String) : [],
  };
}
