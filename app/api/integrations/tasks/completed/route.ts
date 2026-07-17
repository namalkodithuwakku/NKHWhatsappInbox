import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server";

type TaskMessage = {
  id: string;
  conversation_id: string;
  ai_task_payload?: {
    decision?: { subject?: string };
  } | null;
  conversation?: {
    contact?: {
      wa_id?: string;
      name_prefix?: string | null;
      contact_name?: string | null;
      profile_name?: string | null;
      property_id?: string | null;
    } | null;
  } | null;
};

type Property = {
  preferred_language?: string | null;
};

function secretsMatch(received: string | null) {
  const secret = process.env.INBOX_INTEGRATION_SECRET;
  if (!secret || !received) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function completionText(input: {
  name: string;
  language: string;
  subject: string;
  completionNote: string;
}) {
  const name = input.name || "team";
  const subject = input.subject || "your request";
  const result = input.completionNote || subject;
  const language = input.language.toLowerCase();

  if (language === "singlish") {
    return `Hello ${name}, oyage request eka ape team eka complete kara: ${result}.`;
  }
  if (language === "sinhala") {
    return `ආයුබෝවන් ${name}, ඔබගේ ඉල්ලීම අපගේ කණ්ඩායම විසින් සම්පූර්ණ කර ඇත: ${result}.`;
  }
  if (language === "tamil") {
    return `வணக்கம் ${name}, உங்கள் கோரிக்கை எங்கள் குழுவால் நிறைவு செய்யப்பட்டது: ${result}.`;
  }
  return `Hello ${name}, your request has been completed by our team: ${result}.`;
}

async function sendWhatsAppCompletion(input: {
  conversationId: string;
  waId: string;
  text: string;
}) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("WhatsApp sending credentials are not configured");

  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.waId,
      type: "text",
      text: { preview_url: false, body: input.text },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "WhatsApp rejected the completion message");

  const metaMessageId = String(data?.messages?.[0]?.id || "");
  const now = new Date().toISOString();
  await supabaseRest("wa_messages", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: input.conversationId,
      meta_message_id: metaMessageId || null,
      direction: "outgoing",
      message_type: "text",
      body: input.text,
      delivery_status: "sent",
      sent_by: "NKH AI Assistant",
      meta_timestamp: now,
      raw_payload: data,
    }),
  });
  await supabaseRest(`wa_conversations?id=eq.${encodeURIComponent(input.conversationId)}`, {
    method: "PATCH",
    body: JSON.stringify({ last_message_preview: input.text.slice(0, 180), last_message_at: now }),
  });
  return metaMessageId;
}

export async function POST(request: NextRequest) {
  if (!secretsMatch(request.headers.get("x-nkh-inbox-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const taskId = String(body.taskId || "").trim();
  const status = String(body.status || "").trim().toLowerCase();
  const completionNote = String(body.completionNote || "").trim();
  if (!taskId || !["done", "completed"].includes(status)) {
    return NextResponse.json({ error: "A completed task ID is required" }, { status: 400 });
  }

  try {
    const messages = await supabaseRest<TaskMessage[]>(
      `wa_messages?ai_task_id=eq.${encodeURIComponent(taskId)}&direction=eq.incoming&select=id,conversation_id,ai_task_payload,conversation:wa_conversations(contact:wa_contacts(wa_id,name_prefix,contact_name,profile_name,property_id))&limit=1`,
    );
    const message = messages[0];
    if (!message) return NextResponse.json({ sent: false, skipped: true, reason: "Task is not linked to an Inbox message" });

    const locked = await supabaseRest<Array<{ id: string }>>(
      `wa_messages?id=eq.${encodeURIComponent(message.id)}&completion_notification_status=is.null`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ completion_notification_status: "processing", completion_notification_error: null }),
      },
    );
    if (!locked[0]) return NextResponse.json({ sent: false, skipped: true, reason: "Completion was already handled" });

    const contact = message.conversation?.contact;
    if (!contact?.wa_id) throw new Error("Linked WhatsApp contact was not found");

    let language = "English";
    if (contact.property_id) {
      const properties = await supabaseRest<Property[]>(
        `nkh_properties?id=eq.${encodeURIComponent(contact.property_id)}&select=preferred_language&limit=1`,
      );
      language = String(properties[0]?.preferred_language || "English");
    }

    const text = completionText({
      name: `${contact.name_prefix || ""} ${contact.contact_name || contact.profile_name || "team"}`.trim(),
      language,
      subject: String(message.ai_task_payload?.decision?.subject || "your request").trim(),
      completionNote,
    });
    const replyMessageId = await sendWhatsAppCompletion({
      conversationId: message.conversation_id,
      waId: contact.wa_id,
      text,
    });

    await supabaseRest(`wa_messages?id=eq.${encodeURIComponent(message.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        completion_notification_status: "sent",
        completion_notification_message_id: replyMessageId || null,
        completion_notification_sent_at: new Date().toISOString(),
        completion_notification_error: null,
      }),
    });
    return NextResponse.json({ sent: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.slice(0, 500) : "Completion notification failed";
    await supabaseRest(`wa_messages?ai_task_id=eq.${encodeURIComponent(taskId)}&direction=eq.incoming`, {
      method: "PATCH",
      body: JSON.stringify({ completion_notification_status: "failed", completion_notification_error: errorMessage }),
    }).catch(() => undefined);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
