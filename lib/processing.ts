import type { EventRecord } from "./types";

const rules = {
  diaspora: /diaspora|africain(?:e|es|s)?|afrique/i,
  investment: /invest(?:ir|issement|isseur)|financ(?:e|ement|eur)/i,
  economic: /économ|entrepren|business|commerce|industrie/i,
  france: /france|paris|lyon|bordeaux|marseille|lille|nantes|toulouse/i,
  culturalOnly: /concert|musique|soirée dansante|dj set|festival de musique|spectacle|théâtre|projection|vernissage|gastronomie|danse/i,
};

export function scoreCandidate(input: { title: string; description: string; city?: string; future?: boolean }) {
  const text = `${input.title} ${input.description} ${input.city ?? ""}`;
  const reasons: string[] = [];
  let score = 0;
  if (rules.diaspora.test(text)) { score += 25; reasons.push("Lien Afrique ou diaspora (+25)"); }
  if (rules.investment.test(text)) { score += 25; reasons.push("Investissement ou financement (+25)"); }
  if (rules.economic.test(text)) { score += 15; reasons.push("Dimension économique (+15)"); }
  if (rules.france.test(text)) { score += 10; reasons.push("Localisation France (+10)"); }
  if (input.future) { score += 10; reasons.push("Date future (+10)"); }
  if (rules.culturalOnly.test(text) && !rules.investment.test(text) && !rules.economic.test(text)) {
    score = Math.max(0, score - 30);
    reasons.push("Contenu culturel sans dimension économique explicite (-30)");
  }
  return { score, reasons, priority: score >= 80 ? "Élevée" : score >= 60 ? "Pertinent" : score >= 40 ? "À examiner" : "Faible" };
}

export function normalizeTitle(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function eventFingerprint(event: Pick<EventRecord, "title" | "date" | "city">) {
  return `${normalizeTitle(event.title)}|${event.date.slice(0, 10)}|${normalizeTitle(event.city)}`;
}

export function deduplicateEvents(items: EventRecord[]) {
  const seen = new Map<string, EventRecord>();
  for (const item of items) {
    const key = eventFingerprint(item);
    const previous = seen.get(key);
    if (!previous || item.sourceCount > previous.sourceCount) seen.set(key, item);
  }
  return [...seen.values()];
}

export function economicEventIdentity(input: { title: string; startsAt: string; city?: string; organizer?: string }) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(input.startsAt));
  const legacy = `${normalizeTitle(input.title)}|${day}|${normalizeTitle(input.city ?? "online")}`;
  return { legacy, key: `${legacy}|${normalizeTitle(input.organizer ?? "")}` };
}
