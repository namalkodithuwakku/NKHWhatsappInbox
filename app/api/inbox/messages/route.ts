import { NextRequest, NextResponse } from "next/server";
import { isInboxAuthenticated } from "@/lib/inbox-auth";
import { supabaseRest } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  if (!(await isInboxAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversation_id");
  if (!conversationId) return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
  try {
    const messages = await supabaseRest<unknown[]>(`wa_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=created_at.asc`);
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load messages" }, { status: 500 });
  }
}
