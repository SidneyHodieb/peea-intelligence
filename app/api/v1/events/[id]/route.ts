import { NextResponse } from "next/server";
import { getSupabaseAdmin, mapEventRow } from "@/lib/supabase-server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: row, error } = await getSupabaseAdmin().from("events").select("*").eq("id", id).eq("is_demo", false).maybeSingle();
  if (error) return NextResponse.json({ error: { code: "SUPABASE_ERROR", message: error.message } }, { status: 503 });
  if (!row) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Événement introuvable" } }, { status: 404 });
  const event = mapEventRow(row);
  return NextResponse.json({ data: event, meta: { mode: "live" } });
}
