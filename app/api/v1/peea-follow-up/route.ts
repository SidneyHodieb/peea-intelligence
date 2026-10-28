import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [participationsResult, contactsResult, actionsResult] = await Promise.all([
      supabase.from("peea_event_participations").select("*").order("occurred_on", { ascending: false, nullsFirst: false }),
      supabase.from("peea_relationship_contacts").select("id, participation_id, full_name, met_at, organization_or_role, peea_referrers, notes, linkedin_note").order("full_name", { ascending: true }),
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

    const contacts = (contactsResult.data ?? []).map(row => ({
      id: row.id,
      participationId: row.participation_id,
      fullName: row.full_name,
      metAt: row.met_at,
      organizationOrRole: row.organization_or_role,
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

    return NextResponse.json({ data: { participations, contacts, actions }, meta: { mode: "live" } });
  } catch (error) {
    console.error("peea_follow_up_read_failed", error);
    return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: "Lecture du suivi PEEA impossible" } }, { status: 503 });
  }
}
