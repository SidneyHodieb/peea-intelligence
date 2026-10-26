import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evidenceSchema, eventPatchSchema, importEvent } from "@/lib/external-enrichment";
import { authorizeExternal, externalError, externalJson } from "@/lib/external-api";

const requestSchema = z.object({ evidence: evidenceSchema, patch: eventPatchSchema.refine(value => Object.keys(value).length > 0, "Patch vide"), dryRun: z.boolean().default(false) }).strict();
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authorizeExternal(request); if (auth.response) return auth.response;
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: { code: "INVALID_ID" } }, { status: 422 });
    const parsed = requestSchema.safeParse(await externalJson(request));
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 422 });
    const result = await importEvent(parsed.data.patch, parsed.data.evidence, id, auth.actor, parsed.data.dryRun);
    return NextResponse.json({ data: result });
  } catch (cause) { return externalError(cause); }
}
