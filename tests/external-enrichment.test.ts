import { describe, expect, it } from "vitest";
import { eventCandidateSchema, evidenceSchema } from "../lib/external-enrichment";

describe("external enrichment contract", () => {
  it("accepts a sourced event but does not accept an unsupported verification level", () => {
    expect(eventCandidateSchema.parse({ title: "Forum Afrique–France", description: "Financement et B2B", city: "Paris" }).title).toBe("Forum Afrique–France");
    expect(evidenceSchema.parse({ sourceUrl: "https://example.org/event", content: "Annonce publique" }).sourceName).toBe("Recherche externe");
    expect(() => eventCandidateSchema.parse({ title: "Forum", description: "", verification: "official" })).toThrow();
  });
});
