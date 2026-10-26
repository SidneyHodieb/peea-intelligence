import { describe, expect, it } from "vitest";
import { deduplicateEvents, eventFingerprint, normalizeTitle, scoreCandidate } from "../lib/processing";
import { events } from "../lib/demo-data";
import { buildPriorityQueries, getDiscoveryTaxonomy, getSourceCatalog, validateCatalog } from "../lib/discovery-config";

describe("deterministic processing", () => {
  it("scores explicit Africa, diaspora and investment signals", () => {
    const result = scoreCandidate({ title: "Diaspora africaine : investir au Sénégal", description: "Forum économique à Paris", city: "Paris", future: true });
    expect(result.score).toBe(85); expect(result.priority).toBe("Élevée"); expect(result.reasons).toHaveLength(5);
  });
  it("does not promote a generic concert", () => { expect(scoreCandidate({ title: "Concert de la diaspora", description: "Musique et danse", city: "Paris", future: true }).score).toBe(15); });
  it("normalizes accents and punctuation", () => { expect(normalizeTitle("Forum Afrique–Économie !")).toBe("forum afrique economie"); });
  it("deduplicates same title, date and city", () => { const duplicate = { ...events[0], id: "copy", sourceCount: 1 }; expect(deduplicateEvents([events[0], duplicate])).toEqual([events[0]]); expect(eventFingerprint(events[0])).toContain("2026-11-14"); });
});

describe("discovery configuration", () => {
  it("contains a valid, broad source catalog", () => {
    const validation = validateCatalog();
    expect(validation.errors).toEqual([]);
    expect(getSourceCatalog().length).toBeGreaterThanOrEqual(60);
  });
  it("covers all African sovereign states and metropolitan territories", () => {
    const taxonomy = getDiscoveryTaxonomy();
    expect(taxonomy.africanCountries).toHaveLength(54);
    expect(taxonomy.regionsFrance).toContain("Île-de-France");
    expect(taxonomy.regionsFrance).toContain("La Réunion");
  });
  it("builds bounded, high-intent Brave queries", () => {
    const queries = buildPriorityQueries(25);
    expect(queries).toHaveLength(25);
    expect(queries.every(query => query.length < 600)).toBe(true);
  });
});
