import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evidenceSchema, eventCandidateSchema, importEvent } from "@/lib/external-enrichment";

const requestSchema = z.object({
  records: z.array(z.object({ event: eventCandidateSchema, evidence: evidenceSchema })).min(1).max(50),
  dryRun: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 422 });
  if (parsed.data.dryRun) return NextResponse.json({ data: { valid: parsed.data.records.length, dry_run: true } });

  const results: Array<Record<string, unknown>> = [];
  for (const [index, record] of parsed.data.records.entries()) {
    try { results.push({ index, ok: true, ...(await importEvent(record.event, record.evidence)) }); }
    catch (error) { results.push({ index, ok: false, error: error instanceof Error ? error.message : "Échec d’import" }); }
  }
  const succeeded = results.filter(result => result.ok).length;
  return NextResponse.json({ data: { succeeded, failed: results.length - succeeded, results } }, { status: succeeded === results.length ? 201 : 207 });
}
