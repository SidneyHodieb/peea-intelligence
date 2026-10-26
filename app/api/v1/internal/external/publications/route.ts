import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evidenceSchema, publicationSchema, importPublication } from "@/lib/external-enrichment";
import { authorizeExternal, externalError, externalJson } from "@/lib/external-api";
const requestSchema = publicationSchema.extend({ evidence: evidenceSchema, dryRun: z.boolean().default(false) });
export async function POST(request: NextRequest) {
  const auth = authorizeExternal(request); if (auth.response) return auth.response;
  try {
    const parsed = requestSchema.safeParse(await externalJson(request));
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 422 });
    const { evidence, dryRun, ...input } = parsed.data;
    const result = await importPublication(input, evidence, undefined, auth.actor, dryRun);
    return NextResponse.json({ data: result }, { status: dryRun ? 200 : 201 });
  } catch (cause) { return externalError(cause); }
}
