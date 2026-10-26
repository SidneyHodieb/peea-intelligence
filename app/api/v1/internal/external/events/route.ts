import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evidenceSchema, eventImportSchema, importEvent, ExternalWriteError } from "@/lib/external-enrichment";
import { authorizeExternal, externalError, externalJson } from "@/lib/external-api";

const requestSchema = z.object({
  records: z.array(z.object({ event: eventImportSchema, evidence: evidenceSchema }).strict()).min(1).max(50),
  dryRun: z.boolean().default(false),
}).strict();

export async function POST(request: NextRequest) {
  const auth = authorizeExternal(request); if (auth.response) return auth.response;
  try {
    const parsed = requestSchema.safeParse(await externalJson(request));
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 422 });
    const results: Array<Record<string, unknown>> = [];
    for (const [index, record] of parsed.data.records.entries()) {
      try { results.push({ index, ok: true, ...(await importEvent(record.event, record.evidence, undefined, auth.actor, parsed.data.dryRun)) }); }
      catch (error) { results.push({ index, ok: false, error: error instanceof ExternalWriteError ? error.code : "INTERNAL_ERROR", ...(error instanceof ExternalWriteError ? { requestId: error.requestId } : {}) }); }
    }
    const succeeded = results.filter(result => result.ok).length;
    return NextResponse.json({ data: { succeeded, failed: results.length - succeeded, dry_run: parsed.data.dryRun, ...(parsed.data.dryRun ? { valid: succeeded } : {}), results } },
      { status: succeeded === results.length ? (parsed.data.dryRun ? 200 : 201) : 207 });
  } catch (cause) { return externalError(cause); }
}
