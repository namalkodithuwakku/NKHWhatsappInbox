import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { getInboxSession, isInboxAuthenticated } from "@/lib/inbox-auth";
import { supabaseRest } from "@/lib/supabase-server";
import { recordInboxAudit } from "@/lib/inbox-audit";
=======
import { isInboxAuthenticated } from "@/lib/inbox-auth";
import { supabaseRest } from "@/lib/supabase-server";
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26

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
<<<<<<< HEAD

export async function DELETE(request: NextRequest) {
  const session = await getInboxSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Conversation id required" }, { status: 400 });
  const encodedId = encodeURIComponent(id);
  try {
    const rows = await supabaseRest<Array<{ id: string; contact_id?: string; last_message_preview?: string }>>(
      `wa_conversations?id=eq.${encodedId}&select=id,contact_id,last_message_preview`,
    );
    if (!rows[0]) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    await supabaseRest(`wa_internal_notes?conversation_id=eq.${encodedId}`, { method: "DELETE" });
    await supabaseRest(`wa_messages?conversation_id=eq.${encodedId}`, { method: "DELETE" });
    await supabaseRest(`wa_conversations?id=eq.${encodedId}`, { method: "DELETE" });
    await recordInboxAudit({
      role: session.role,
      action: "delete",
      entityType: "conversation",
      entityId: id,
      details: { contact_id: rows[0].contact_id, preview: rows[0].last_message_preview },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 500 });
  }
}
=======
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26
