import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evidenceSchema, importPublication } from "@/lib/external-enrichment";

const requestSchema = z.object({
  title: z.string().min(3).max(500), content: z.string().min(1).max(20_000), publishedAt: z.iso.datetime().optional(),
  eventId: z.uuid().optional(), evidence: evidenceSchema, dryRun: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 422 });
  if (parsed.data.dryRun) return NextResponse.json({ data: { valid: true, dry_run: true } });
  try {
    const result = await importPublication(parsed.data, parsed.data.evidence);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (cause) {
    return NextResponse.json({ error: { code: "IMPORT_ERROR", message: cause instanceof Error ? cause.message : "Import impossible" } }, { status: 503 });
  }
}
