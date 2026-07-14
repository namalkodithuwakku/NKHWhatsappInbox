import { NextRequest, NextResponse } from "next/server";
import { isInboxAuthenticated } from "@/lib/inbox-auth";
import { supabaseRest } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  if (!(await isInboxAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { conversation_id, note, created_by = "NKH Team" } = await request.json();
  if (!conversation_id || !String(note ?? "").trim()) return NextResponse.json({ error: "Conversation and note required" }, { status: 400 });
  try {
    await supabaseRest("wa_internal_notes", { method: "POST", body: JSON.stringify({ conversation_id, note: String(note).trim(), created_by }) });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save note" }, { status: 500 });
  }
}
