/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server";

type ContactRow = { id: string; wa_id: string; phone: string; profile_name?: string | null; property_name?: string | null };
type ConversationRow = { id: string; unread_count: number };

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const mode = query.get("hub.mode");
  const token = query.get("hub.verify_token");
  const challenge = query.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Webhook verification failed" }, { status: 403 });
}

function validSignature(body: string, signature: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true;
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function messageBody(message: Record<string, any>) {
  if (message.type === "text") return message.text?.body ?? "";
  if (message.type === "button") return message.button?.text ?? "Button response";
  if (message.type === "interactive") return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? "Interactive response";
  if (message.type === "image") return message.image?.caption ?? "Photo";
  if (message.type === "document") return message.document?.caption ?? message.document?.filename ?? "Document";
  if (message.type === "audio") return "Audio message";
  if (message.type === "video") return message.video?.caption ?? "Video";
  if (message.type === "location") return "Location";
  return `Unsupported ${message.type ?? "message"}`;
}

async function upsertContact(waId: string, profileName?: string) {
  const rows = await supabaseRest<ContactRow[]>("wa_contacts?on_conflict=wa_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ wa_id: waId, phone: waId, profile_name: profileName || null }),
  });
  return rows[0];
}

async function getConversation(contactId: string) {
  const existing = await supabaseRest<ConversationRow[]>(`wa_conversations?contact_id=eq.${contactId}&select=id,unread_count`);
  if (existing[0]) return existing[0];
  const created = await supabaseRest<ConversationRow[]>("wa_conversations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ contact_id: contactId, status: "Open", label: "Client Support" }),
  });
  return created[0];
}

async function processIncoming(value: Record<string, any>) {
  const profileName = value.contacts?.[0]?.profile?.name;
  for (const message of value.messages ?? []) {
    const waId = String(message.from ?? value.contacts?.[0]?.wa_id ?? "");
    if (!waId || !message.id) continue;
    const contact = await upsertContact(waId, profileName);
    const conversation = await getConversation(contact.id);
    const timestamp = message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date();
    const body = messageBody(message);
    await supabaseRest("wa_messages?on_conflict=meta_message_id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({
        conversation_id: conversation.id,
        meta_message_id: message.id,
        direction: "incoming",
        message_type: message.type ?? "text",
        body,
        media_id: message.image?.id ?? message.document?.id ?? message.audio?.id ?? message.video?.id ?? null,
        reply_to_meta_message_id: message.context?.id ?? null,
        delivery_status: "received",
        meta_timestamp: timestamp.toISOString(),
        raw_payload: message,
      }),
    });
    await supabaseRest(`wa_conversations?id=eq.${conversation.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "Open",
        unread_count: (conversation.unread_count ?? 0) + 1,
        last_message_preview: body.slice(0, 180),
        last_message_at: timestamp.toISOString(),
        customer_window_expires_at: new Date(timestamp.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
  }
}

async function processStatuses(value: Record<string, any>) {
  for (const status of value.statuses ?? []) {
    if (!status.id || !["sent", "delivered", "read", "failed"].includes(status.status)) continue;
    await supabaseRest(`wa_messages?meta_message_id=eq.${encodeURIComponent(status.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ delivery_status: status.status, error_message: status.errors?.[0]?.title ?? null, raw_payload: status }),
    });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!validSignature(body, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    const payload = JSON.parse(body);
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        await processIncoming(change.value ?? {});
        await processStatuses(change.value ?? {});
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("WhatsApp webhook error", error);
    return NextResponse.json({ received: true });
  }
}
