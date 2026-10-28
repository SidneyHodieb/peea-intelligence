import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const dateValue = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]);
const nullableText = (max: number) => z.union([z.string().trim().max(max), z.null()]);
const participationSchema = z.object({
  eventName: z.string().trim().min(1).max(300), occurredOn: dateValue, endsOn: dateValue,
  timeText: nullableText(100), venue: nullableText(500), sourceUrl: z.union([z.url(), z.literal(""), z.null()]),
  representatives: z.array(z.string().trim().min(1).max(120)).max(30),
  appointmentStatus: z.enum(["validated", "not_validated", "in_progress", "unknown"]),
  attended: z.boolean().nullable(), comments: nullableText(5000), nextStep: nullableText(2000),
});
const contactSchema = z.object({
  participationId: z.uuid().nullable(), fullName: z.string().trim().min(1).max(240), metAt: nullableText(300),
  organizationOrRole: nullableText(500), phones: z.array(z.string().trim().min(1).max(80)).max(10),
  email: z.union([z.email(), z.literal(""), z.null()]), peeaReferrers: z.array(z.string().trim().min(1).max(120)).max(30),
  notes: nullableText(5000), linkedinNote: nullableText(1000),
});
const actionSchema = z.object({
  contactId: z.uuid().nullable(), title: z.string().trim().min(1).max(500), dueDate: dateValue,
  status: z.enum(["waiting", "in_progress", "done", "cancelled"]),
  owners: z.array(z.string().trim().min(1).max(120)).max(30), comments: nullableText(5000),
});
const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("participation"), data: participationSchema }),
  z.object({ kind: z.literal("contact"), data: contactSchema }),
  z.object({ kind: z.literal("action"), data: actionSchema }),
]);
type ContactRow = { id: string; participation_id: string | null; full_name: string; met_at: string | null; organization_or_role: string | null; phones?: string[] | null; email?: string | null; peea_referrers: string[] | null; notes: string | null; linkedin_note: string | null };

function clean(value: string | null | undefined) { return value?.trim() || null; }

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [participationsResult, contactsResult, actionsResult] = await Promise.all([
      supabase.from("peea_event_participations").select("*").order("occurred_on", { ascending: false, nullsFirst: false }),
      supabase.from("peea_relationship_contacts").select("id, participation_id, full_name, met_at, organization_or_role, phones, email, peea_referrers, notes, linkedin_note").order("full_name", { ascending: true }),
      supabase.from("peea_follow_up_actions").select("*, peea_relationship_contacts(full_name)").order("due_date", { ascending: true, nullsFirst: false }),
    ]);

    if (participationsResult.error) throw participationsResult.error;
    if (contactsResult.error) throw contactsResult.error;
    if (actionsResult.error) throw actionsResult.error;

    const participations = (participationsResult.data ?? []).map(row => ({
      id: row.id,
      eventId: row.event_id ?? undefined,
      eventName: row.event_name,
      occurredOn: row.occurred_on,
      endsOn: row.ends_on,
      timeText: row.time_text,
      venue: row.venue,
      sourceUrl: row.source_url,
      representatives: row.representatives ?? [],
      appointmentStatus: row.appointment_status,
      attended: row.attended,
      comments: row.comments,
      nextStep: row.next_step,
    }));

    const contacts = ((contactsResult.data ?? []) as unknown as ContactRow[]).map(row => ({
      id: row.id,
      participationId: row.participation_id,
      fullName: row.full_name,
      metAt: row.met_at,
      organizationOrRole: row.organization_or_role,
      phones: row.phones ?? [],
      email: row.email,
      peeaReferrers: row.peea_referrers ?? [],
      notes: row.notes,
      linkedinNote: row.linkedin_note,
    }));

    const actions = (actionsResult.data ?? []).map(row => {
      const contact = row.peea_relationship_contacts as { full_name?: string } | null;
      return {
        id: row.id,
        contactId: row.contact_id,
        contactName: contact?.full_name ?? null,
        title: row.title,
        dueDate: row.due_date,
        status: row.status,
        owners: row.owners ?? [],
        comments: row.comments,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({ data: { participations, contacts, actions }, meta: { mode: "live", editor: true } });
  } catch (error) {
    console.error("peea_follow_up_read_failed", error);
    return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: "Lecture du suivi PEEA impossible" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 422 });
    const supabase = getSupabaseAdmin();
    const sourceKey = `app-${parsed.data.kind}-${randomUUID()}`;
    let result;
    if (parsed.data.kind === "participation") {
      const d = parsed.data.data;
      result = await supabase.from("peea_event_participations").insert({ source_key: sourceKey, event_name: d.eventName, occurred_on: d.occurredOn, ends_on: d.endsOn, time_text: clean(d.timeText), venue: clean(d.venue), source_url: clean(d.sourceUrl), representatives: d.representatives, appointment_status: d.appointmentStatus, attended: d.attended, comments: clean(d.comments), next_step: clean(d.nextStep) }).select("id").single();
    } else if (parsed.data.kind === "contact") {
      const d = parsed.data.data;
      result = await supabase.from("peea_relationship_contacts").insert({ source_key: sourceKey, participation_id: d.participationId, full_name: d.fullName, met_at: clean(d.metAt), organization_or_role: clean(d.organizationOrRole), phones: d.phones, email: clean(d.email), peea_referrers: d.peeaReferrers, notes: clean(d.notes), linkedin_note: clean(d.linkedinNote) }).select("id").single();
    } else {
      const d = parsed.data.data;
      result = await supabase.from("peea_follow_up_actions").insert({ source_key: sourceKey, contact_id: d.contactId, title: d.title, due_date: d.dueDate, status: d.status, owners: d.owners, comments: clean(d.comments) }).select("id").single();
    }
    if (result.error) throw result.error;
    return NextResponse.json({ data: { id: result.data.id } }, { status: 201 });
  } catch (error) {
    console.error("peea_follow_up_create_failed", error);
    return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: "Création impossible" } }, { status: 503 });
  }
}
