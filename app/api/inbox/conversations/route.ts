import { NextRequest, NextResponse } from "next/server";
import { isInboxAuthenticated } from "@/lib/inbox-auth";
import { supabaseRest } from "@/lib/supabase-server";

export async function GET() {
  if (!(await isInboxAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await supabaseRest<unknown[]>("wa_conversations?select=*,contact:wa_contacts(*)&order=last_message_at.desc.nullslast");
    return NextResponse.json({ conversations: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load inbox" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isInboxAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, status, assigned_to, label, unread_count, property_name } = await request.json();
  if (!id) return NextResponse.json({ error: "Conversation id required" }, { status: 400 });
  const update = Object.fromEntries(Object.entries({ status, assigned_to, label, unread_count }).filter(([, value]) => value !== undefined));
  try {
    const rows = await supabaseRest<Array<{ contact_id: string }>>(`wa_conversations?id=eq.${encodeURIComponent(id)}&select=contact_id`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(update),
    });
    if (property_name !== undefined && rows[0]?.contact_id) {
      await supabaseRest(`wa_contacts?id=eq.${rows[0].contact_id}`, { method: "PATCH", body: JSON.stringify({ property_name }) });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 500 });
  }
}
