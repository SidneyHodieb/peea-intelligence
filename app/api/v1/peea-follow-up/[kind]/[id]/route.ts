import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const dateValue = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]);
const nullableText = (max: number) => z.union([z.string().trim().max(max), z.null()]);
const schemas = {
  participation: z.object({ eventName: z.string().trim().min(1).max(300), occurredOn: dateValue, endsOn: dateValue, timeText: nullableText(100), venue: nullableText(500), sourceUrl: z.union([z.url(), z.literal(""), z.null()]), representatives: z.array(z.string().trim().min(1).max(120)).max(30), appointmentStatus: z.enum(["validated", "not_validated", "in_progress", "unknown"]), attended: z.boolean().nullable(), comments: nullableText(5000), nextStep: nullableText(2000) }),
  contact: z.object({ participationId: z.uuid().nullable(), fullName: z.string().trim().min(1).max(240), metAt: nullableText(300), organizationOrRole: nullableText(500), phones: z.array(z.string().trim().min(1).max(80)).max(10), email: z.union([z.email(), z.literal(""), z.null()]), peeaReferrers: z.array(z.string().trim().min(1).max(120)).max(30), notes: nullableText(5000), linkedinNote: nullableText(1000) }),
  action: z.object({ contactId: z.uuid().nullable(), title: z.string().trim().min(1).max(500), dueDate: dateValue, status: z.enum(["waiting", "in_progress", "done", "cancelled"]), owners: z.array(z.string().trim().min(1).max(120)).max(30), comments: nullableText(5000) }),
};
const tableByKind = { participation: "peea_event_participations", contact: "peea_relationship_contacts", action: "peea_follow_up_actions" } as const;
function clean(value: string | null | undefined) { return value?.trim() || null; }

export async function PATCH(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await context.params;
  if (!(kind in schemas) || !z.uuid().safeParse(id).success) return NextResponse.json({ error: { code: "INVALID_TARGET" } }, { status: 404 });
  const typedKind = kind as keyof typeof schemas;
  const parsed = schemas[typedKind].safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 422 });
  const d = parsed.data as Record<string, unknown>;
  let patch: Record<string, unknown>;
  if (typedKind === "participation") patch = { event_name: d.eventName, occurred_on: d.occurredOn, ends_on: d.endsOn, time_text: clean(d.timeText as string | null), venue: clean(d.venue as string | null), source_url: clean(d.sourceUrl as string | null), representatives: d.representatives, appointment_status: d.appointmentStatus, attended: d.attended, comments: clean(d.comments as string | null), next_step: clean(d.nextStep as string | null), updated_at: new Date().toISOString() };
  else if (typedKind === "contact") patch = { participation_id: d.participationId, full_name: d.fullName, met_at: clean(d.metAt as string | null), organization_or_role: clean(d.organizationOrRole as string | null), phones: d.phones, email: clean(d.email as string | null), peea_referrers: d.peeaReferrers, notes: clean(d.notes as string | null), linkedin_note: clean(d.linkedinNote as string | null), updated_at: new Date().toISOString() };
  else patch = { contact_id: d.contactId, title: d.title, due_date: d.dueDate, status: d.status, owners: d.owners, comments: clean(d.comments as string | null), updated_at: new Date().toISOString() };
  const { data, error } = await getSupabaseAdmin().from(tableByKind[typedKind]).update(patch).eq("id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: "Mise à jour impossible" } }, { status: 503 });
  if (!data) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  return NextResponse.json({ data: { id: data.id } });
}
