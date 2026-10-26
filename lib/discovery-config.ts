import sourceCatalog from "../config/source-catalog.json";
import taxonomy from "../config/discovery-taxonomy.json";

export type SourceConfig = (typeof sourceCatalog.sources)[number];

export function getSourceCatalog() {
  return sourceCatalog.sources;
}

export function getDiscoveryTaxonomy() {
  return taxonomy;
}

export function buildPriorityQueries(limit = 60) {
  const queries = new Set<string>(taxonomy.queryTemplates);
  for (const phrase of taxonomy.priorityPhrases) {
    queries.add(`"${phrase}" (France OR Paris OR Lyon OR Marseille OR Bordeaux OR Lille OR Toulouse OR Nantes)`);
    if (queries.size >= limit) break;
  }
  return [...queries].slice(0, limit);
}

export function validateCatalog() {
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const source of sourceCatalog.sources) {
    if (ids.has(source.id)) errors.push(`Identifiant dupliqué: ${source.id}`);
    ids.add(source.id);
    try { new URL(source.url); } catch { errors.push(`URL invalide: ${source.id}`); }
    if (source.cadenceMinutes < 60) errors.push(`Cadence trop agressive: ${source.id}`);
  }
  if (taxonomy.africanCountries.length !== 54) errors.push(`La liste doit contenir 54 pays africains, reçu: ${taxonomy.africanCountries.length}`);
  return { valid: errors.length === 0, errors, sourceCount: sourceCatalog.sources.length, countryCount: taxonomy.africanCountries.length };
}
