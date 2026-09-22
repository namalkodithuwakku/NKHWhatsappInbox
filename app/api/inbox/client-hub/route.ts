import { NextRequest, NextResponse } from "next/server";
import { isInboxAuthenticated } from "@/lib/inbox-auth";
import { supabaseRest } from "@/lib/supabase-server";

type ClientRequest = {
  id: string;
  conversation_id: string;
  request_type: string;
  subject: string;
  status: string;
  priority: string;
  assigned_to?: string | null;
  due_at?: string | null;
  completion_note?: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: NextRequest) {
  if (!(await isInboxAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversation_id");
  if (!conversationId) return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
  try {
    const rows = await supabaseRest<ClientRequest[]>(
      `wa_client_requests?conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=created_at.desc&limit=30`,
    );
    return NextResponse.json({ requests: rows });
  } catch (error) {
    // Keep the inbox usable before the additive Phase 2 migration is applied.
    console.error("Client hub requests unavailable", error);
    return NextResponse.json({ requests: [], migration_required: true });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isInboxAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, status, assigned_to, due_at, completion_note } = await request.json();
  if (!id) return NextResponse.json({ error: "Request id required" }, { status: 400 });
  if (status !== undefined && !["Open", "In progress", "Waiting", "Completed", "Cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const update = Object.fromEntries(Object.entries({
    status,
    assigned_to,
    due_at,
    completion_note,
    completed_at: status === "Completed" ? new Date().toISOString() : undefined,
    updated_at: new Date().toISOString(),
  }).filter(([, value]) => value !== undefined));
  try {
    await supabaseRest(`wa_client_requests?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request update failed" }, { status: 500 });
  }
}
