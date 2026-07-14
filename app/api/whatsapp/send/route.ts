import { NextRequest, NextResponse } from "next/server";
import { isInboxAuthenticated } from "@/lib/inbox-auth";
import { supabaseRest } from "@/lib/supabase-server";

type Target = { id: string; contact: { wa_id: string } };

export async function POST(request: NextRequest) {
  if (!(await isInboxAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { conversation_id, text, sent_by = "NKH Team" } = await request.json();
  if (!conversation_id || !String(text ?? "").trim()) return NextResponse.json({ error: "Conversation and message are required" }, { status: 400 });
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return NextResponse.json({ error: "WhatsApp sending credentials are not configured" }, { status: 503 });
  try {
    const targets = await supabaseRest<Target[]>(`wa_conversations?id=eq.${encodeURIComponent(conversation_id)}&select=id,contact:wa_contacts(wa_id)`);
    const target = targets[0];
    if (!target?.contact?.wa_id) return NextResponse.json({ error: "WhatsApp contact not found" }, { status: 404 });
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: target.contact.wa_id, type: "text", text: { preview_url: false, body: String(text).trim() } }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data?.error?.message ?? "WhatsApp rejected the message", details: data }, { status: response.status });
    const metaMessageId = data?.messages?.[0]?.id;
    const now = new Date().toISOString();
    await supabaseRest("wa_messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id, meta_message_id: metaMessageId, direction: "outgoing", message_type: "text", body: String(text).trim(), delivery_status: "sent", sent_by, meta_timestamp: now, raw_payload: data }),
    });
    await supabaseRest(`wa_conversations?id=eq.${encodeURIComponent(conversation_id)}`, {
      method: "PATCH",
      body: JSON.stringify({ last_message_preview: String(text).trim().slice(0, 180), last_message_at: now }),
    });
    return NextResponse.json({ success: true, message_id: metaMessageId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send message" }, { status: 500 });
  }
}
