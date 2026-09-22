import { supabaseRest } from "@/lib/supabase-server";
import { processMessageForTask } from "@/lib/ai-task-creator";

type ContactContext = {
  id: string;
  wa_id: string;
  property_id?: string | null;
  property_name?: string | null;
  contact_name?: string | null;
  profile_name?: string | null;
  job_position?: string | null;
  is_active?: boolean | null;
  client_status?: string | null;
};

type ConversationRow = {
  id: string;
  ai_mode?: "auto" | "paused" | "human" | null;
  assigned_to?: string | null;
};

type HistoryMessage = {
  direction: "incoming" | "outgoing";
  body?: string | null;
  sent_by?: string | null;
  created_at: string;
};

type KnowledgeEntry = {
  id: string;
  scope: string;
  property_id?: string | null;
  title: string;
  content: string;
  owner: string;
  approval_status: string;
  source_url?: string | null;
  last_updated_at: string;
};

type AssistantDecision = {
  action: "answer" | "operational_request" | "clarify" | "escalate" | "no_reply";
  confidence: number;
  language: "English" | "Sinhala" | "Tamil" | "Singlish";
  reply: string;
  reason: string;
  attention_reason: string;
  knowledge_entry_ids: string[];
};

function outputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output as Array<Record<string, unknown>>) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content as Array<Record<string, unknown>>) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

async function recentHistory(conversationId: string) {
  const rows = await supabaseRest<HistoryMessage[]>(
    `wa_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=direction,body,sent_by,created_at&order=created_at.desc&limit=16`,
  );
  return rows.reverse();
}

async function approvedKnowledge(propertyId?: string | null) {
  const rows = await supabaseRest<KnowledgeEntry[]>(
    "nkh_knowledge_entries?approval_status=eq.approved&select=id,scope,property_id,title,content,owner,approval_status,source_url,last_updated_at&order=last_updated_at.desc&limit=80",
  );
  return rows.filter((entry) => !entry.property_id || entry.property_id === propertyId);
}

async function decide(input: {
  latestMessage: string;
  contact: ContactContext;
  history: HistoryMessage[];
  knowledge: KnowledgeEntry[];
}): Promise<AssistantDecision> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_AUTO_REPLY_MODEL || "gpt-5.6-luna",
      reasoning: { effort: "medium" },
      store: false,
      instructions: [
        "You are the front-line WhatsApp assistant for N K Hotels (PVT) LTD, a Sri Lankan hospitality growth and reservation-management company.",
        "Write like an experienced hotel reservations and OTA account manager: warm, concise, commercially aware, practical and natural for WhatsApp.",
        "Understand English, Sinhala, Tamil and Singlish. Reply in the user's language unless the conversation clearly prefers another language.",
        "Use recent conversation history to resolve short messages such as 'yes', 'tomorrow', 'same room', 'how much?', and 'any update?'. Never treat each message in isolation.",
        "The APPROVED KNOWLEDGE supplied below is the source of truth for NKH company facts, services, packages and prices.",
        "Never invent a price, discount, guarantee, availability, deadline, booking status, task status, OTA action, refund, concession, contract term or commitment.",
        "Do not claim that an operational action is completed merely because a request was received or a task can be created.",
        "Distinguish ANSWER from ACKNOWLEDGEMENT from COMPLETION. Completion requires verified system evidence and is not available in this decision step.",
        "For normal company/service questions, choose answer only when approved knowledge supports the factual parts.",
        "Only EXISTING CLIENTS may enter the operational task workflow. A new lead, prospect or unlinked enquiry must never create an operational client task.",
"For an EXISTING CLIENT with a clear operational instruction such as close rooms, change rates, update availability, reply to a guest, or fix an OTA issue, choose operational_request. Do not promise it is done.",
        "If an operational instruction lacks a material property, room, date, booking reference, channel or action detail that cannot be safely inferred from context, choose clarify and ask only the minimum necessary question.",
        "For complaints, sensitive commercial disputes, unclear commitments, unsupported pricing, angry clients, repeated failures, or requests needing management judgment, choose escalate. Acknowledge calmly without admitting fault or promising an outcome.",
        "For sales enquiries, answer useful questions first, then ask the smallest useful next question. Do not interrogate the lead with a long form.",
        "When recommending an NKH service, explain why it fits the stated situation. Do not force a package when details are insufficient.",
        "Avoid robotic phrases, excessive greetings, long lists, emojis unless the customer uses them, and internal terms such as classifier, AI, confidence, database or task ID.",
        "Do not expose private information belonging to another client or property.",
        "If approved knowledge does not support a factual NKH claim, clarify or escalate rather than guessing.",
        "Keep routine replies usually under 90 words; complex sales explanations may be longer when useful.",
      ].join("\n"),
      input: JSON.stringify({
        contact: {
          name: input.contact.contact_name || input.contact.profile_name || "",
          property_name: input.contact.property_name || "",
          job_position: input.contact.job_position || "",
client_status: input.contact.client_status || "",
is_linked_property: Boolean(input.contact.property_id || input.contact.property_name),
        },
        recent_conversation: input.history,
        latest_message: input.latestMessage,
        approved_knowledge: input.knowledge.map((entry) => ({
          id: entry.id,
          scope: entry.scope,
          title: entry.title,
          content: entry.content,
          source_url: entry.source_url,
          last_updated_at: entry.last_updated_at,
        })),
      }),
      text: {
        format: {
          type: "json_schema",
          name: "nkh_auto_reply_decision",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              action: { type: "string", enum: ["answer", "operational_request", "clarify", "escalate", "no_reply"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              language: { type: "string", enum: ["English", "Sinhala", "Tamil", "Singlish"] },
              reply: { type: "string" },
              reason: { type: "string" },
              attention_reason: { type: "string" },
              knowledge_entry_ids: { type: "array", items: { type: "string" } },
            },
            required: ["action", "confidence", "language", "reply", "reason", "attention_reason", "knowledge_entry_ids"],
          },
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const text = outputText(data as Record<string, unknown>);
  if (!text) throw new Error("OpenAI returned no auto-reply decision");
  return JSON.parse(text) as AssistantDecision;
}

async function sendReply(conversationId: string, waId: string, reply: string) {
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
      to: waId,
      type: "text",
      text: { preview_url: false, body: reply.trim() },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "WhatsApp rejected the automatic reply");

  const now = new Date().toISOString();
  const metaMessageId = String(data?.messages?.[0]?.id || "");
  await supabaseRest("wa_messages", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      meta_message_id: metaMessageId || null,
      direction: "outgoing",
      message_type: "text",
      body: reply.trim(),
      delivery_status: "sent",
      sent_by: "NKH Assistant",
      meta_timestamp: now,
      raw_payload: data,
    }),
  });
  await supabaseRest(`wa_conversations?id=eq.${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    body: JSON.stringify({ last_message_preview: reply.trim().slice(0, 180), last_message_at: now }),
  });
  return metaMessageId;
}

export async function processMessageAutomatically(input: {
  storedMessageId: string;
  metaMessageId: string;
  conversationId: string;
  body: string;
  contact: ContactContext;
}) {
  const { storedMessageId, metaMessageId, conversationId, body, contact } = input;
  if (!body.trim() || contact.is_active === false) return;

  const conversations = await supabaseRest<ConversationRow[]>(
    `wa_conversations?id=eq.${encodeURIComponent(conversationId)}&select=id,ai_mode,assigned_to&limit=1`,
  );
  const conversation = conversations[0];
  if (!conversation || (conversation.ai_mode || "auto") !== "auto") return;

  try {
    const [history, knowledge] = await Promise.all([
      recentHistory(conversationId),
      approvedKnowledge(contact.property_id),
    ]);

    const decision = await decide({ latestMessage: body, contact, history, knowledge });

    await supabaseRest("wa_ai_events", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId,
        message_id: storedMessageId,
        event_type:
          decision.action === "answer" ? "answer" :
          decision.action === "clarify" ? "clarification" :
          decision.action === "escalate" ? "escalation" : "skipped",
        decision: decision.reason,
        model: process.env.OPENAI_AUTO_REPLY_MODEL || "gpt-5.6-luna",
        knowledge_entry_ids: decision.knowledge_entry_ids,
        details: { action: decision.action, confidence: decision.confidence, language: decision.language },
      }),
    }).catch(() => undefined);

    if (decision.action === "operational_request") {
      const clientStatus = (contact.client_status || "").toLowerCase();
      const isExistingClient = clientStatus.includes("client") || clientStatus.includes("active");
      const isLinkedClient = isExistingClient && Boolean(contact.property_id || contact.property_name);

      if (!isLinkedClient) {
        await supabaseRest(`wa_conversations?id=eq.${encodeURIComponent(conversationId)}`, {
          method: "PATCH",
          body: JSON.stringify({ label: "Lead", status: "Open", next_action: "Qualify new enquiry" }),
        });
        const leadReply = "Thanks for contacting N K Hotels. I can help with your hotel enquiry. Please share your property name and location, and briefly tell me what you need help with.";
        await sendReply(conversationId, contact.wa_id, leadReply);
        return;
      }

      await processMessageForTask(input);
      await supabaseRest(`wa_conversations?id=eq.${encodeURIComponent(conversationId)}`, {
        method: "PATCH",
        body: JSON.stringify({ label: "Existing Client", next_action: "Operational task created — awaiting completion" }),
      });
      return;
    }

    if (decision.action === "escalate") {
      await supabaseRest(`wa_conversations?id=eq.${encodeURIComponent(conversationId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "Open",
          attention_reason: decision.attention_reason || decision.reason,
          next_action: "Human review required",
        }),
      });
    }

    const shouldReply =
      decision.action !== "no_reply" &&
      decision.reply.trim().length > 0 &&
      decision.confidence >= (decision.action === "answer" ? 0.78 : 0.65);

    if (!shouldReply) return;

    const replyMessageId = await sendReply(conversationId, contact.wa_id, decision.reply);
    await supabaseRest(`wa_messages?id=eq.${encodeURIComponent(storedMessageId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        ai_reply_status: "sent",
        ai_reply_message_id: replyMessageId || null,
        ai_reply_error: null,
      }),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.slice(0, 500) : "Automatic reply failed";
    await supabaseRest("wa_ai_events", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId,
        message_id: storedMessageId,
        event_type: "error",
        decision: errorMessage,
        details: { meta_message_id: metaMessageId },
      }),
    }).catch(() => undefined);
    await supabaseRest(`wa_messages?id=eq.${encodeURIComponent(storedMessageId)}`, {
      method: "PATCH",
      body: JSON.stringify({ ai_reply_status: "failed", ai_reply_error: errorMessage }),
    }).catch(() => undefined);
  }
}
