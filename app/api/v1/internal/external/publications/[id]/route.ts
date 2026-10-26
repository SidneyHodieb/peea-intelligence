import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evidenceSchema, publicationSchema, importPublication } from "@/lib/external-enrichment";
import { authorizeExternal, externalError, externalJson } from "@/lib/external-api";
// Repair the existing publication in place. Its canonical source cannot be changed.
const requestSchema = publicationSchema.extend({ evidence: evidenceSchema, dryRun: z.boolean().default(false) });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authorizeExternal(request); if (auth.response) return auth.response;
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: { code: "INVALID_ID" } }, { status: 422 });
    const parsed = requestSchema.safeParse(await externalJson(request));
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 422 });
    const { evidence, dryRun, ...input } = parsed.data;
    const result = await importPublication(input, evidence, id, auth.actor, dryRun);
    return NextResponse.json({ data: result });
  } catch (cause) { return externalError(cause); }
}
