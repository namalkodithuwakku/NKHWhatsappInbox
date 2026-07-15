import { supabaseRest } from "@/lib/supabase-server";

type ContactContext = {
  id: string;
  property_id?: string | null;
  property_name?: string | null;
  contact_name?: string | null;
  profile_name?: string | null;
  job_position?: string | null;
  is_active?: boolean | null;
};

type PropertyContext = {
  client_code: string;
  property_name: string;
  preferred_language: string;
  client_status: string;
};

type TaskDecision = {
  create_task: boolean;
  confidence: number;
  task_type: "FIT Booking" | "Room block" | "Rate Update" | "Booking Info" | "Promotions" | "OTA Issue" | "Guest message" | "Other";
  priority: "Normal" | "High" | "Urgent";
  subject: string;
  note: string;
  reason: string;
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

async function classify(message: string, contact: ContactContext, property: PropertyContext): Promise<TaskDecision> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TASK_MODEL || "gpt-5.6-luna",
      reasoning: { effort: "low" },
      store: false,
      instructions: [
        "You classify WhatsApp messages from Sri Lankan hotel clients for N K Hotels operations.",
        "Create a task only when the latest message contains a clear, actionable request.",
        "Do not create tasks for greetings, thanks, confirmations, general questions, vague complaints, casual conversation, or unclear intent.",
        "Understand English, Sinhala, Tamil and Singlish. Examples: 'room close kara' means close room availability and is a Room block task; 'me guest awada?' is a question and is not a task.",
        "N K Hotels handles OTA work and travel-agent work. Direct/FIT bookings are hotel-managed, but a clear request to notify or act on one can still become a task.",
        "Never invent dates, booking IDs, guest names, channels or instructions. Put all useful original details in note.",
        "Use High only when delay could affect a near-term booking, availability, guest or revenue. Use Urgent only when the message clearly indicates immediate action today/now.",
        "The subject must be a short operational headline. The note must clearly describe what staff must do and identify the sender.",
      ].join("\n"),
      input: JSON.stringify({
        property_code: property.client_code,
        property_name: property.property_name,
        preferred_language: property.preferred_language,
        sender_name: contact.contact_name || contact.profile_name || "Hotel team",
        sender_position: contact.job_position || "",
        latest_message: message,
      }),
      text: {
        format: {
          type: "json_schema",
          name: "nkh_whatsapp_task_decision",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              create_task: { type: "boolean" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              task_type: { type: "string", enum: ["FIT Booking", "Room block", "Rate Update", "Booking Info", "Promotions", "OTA Issue", "Guest message", "Other"] },
              priority: { type: "string", enum: ["Normal", "High", "Urgent"] },
              subject: { type: "string" },
              note: { type: "string" },
              reason: { type: "string" },
            },
            required: ["create_task", "confidence", "task_type", "priority", "subject", "note", "reason"],
          },
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const text = outputText(data as Record<string, unknown>);
  if (!text) throw new Error("OpenAI returned no task decision");
  return JSON.parse(text) as TaskDecision;
}

async function createDashboardTask(decision: TaskDecision, property: PropertyContext) {
  const url = process.env.DASHBOARD_TASK_API_URL;
  const secret = process.env.INBOX_INTEGRATION_SECRET;
  if (!url || !secret) throw new Error("Dashboard task integration is not configured");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-nkh-inbox-secret": secret },
    body: JSON.stringify({
      taskType: decision.task_type,
      property: property.property_name,
      subject: decision.subject,
      note: decision.note,
      priority: decision.priority,
    }),
  });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.error || "Dashboard rejected task");
  return data;
}

export async function processMessageForTask(input: {
  storedMessageId: string;
  metaMessageId: string;
  body: string;
  contact: ContactContext;
}) {
  const { storedMessageId, metaMessageId, body, contact } = input;
  if (!body.trim() || !contact.property_id || contact.is_active === false) return;

  try {
    const properties = await supabaseRest<PropertyContext[]>(
      `nkh_properties?id=eq.${encodeURIComponent(contact.property_id)}&select=client_code,property_name,preferred_language,client_status`,
    );
    const property = properties[0];
    if (!property || property.client_status !== "Active") return;

    const decision = await classify(body, contact, property);
    const eligible = decision.create_task && decision.confidence >= 0.82 && decision.subject.trim() && decision.note.trim();

    if (!eligible) {
      await supabaseRest(`wa_messages?id=eq.${encodeURIComponent(storedMessageId)}`, {
        method: "PATCH",
        body: JSON.stringify({ ai_task_status: "not_required", ai_task_reason: decision.reason }),
      });
      return;
    }

    const task = await createDashboardTask(decision, property);
    const taskId = String(task.taskId || task.id || task.task?.id || "");
    await supabaseRest(`wa_messages?id=eq.${encodeURIComponent(storedMessageId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        ai_task_status: "created",
        ai_task_id: taskId || null,
        ai_task_reason: decision.reason,
        ai_task_payload: { meta_message_id: metaMessageId, decision, dashboard_response: task },
      }),
    });
  } catch (error) {
    console.error("WhatsApp AI task creator error", error);
    await supabaseRest(`wa_messages?id=eq.${encodeURIComponent(storedMessageId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        ai_task_status: "failed",
        ai_task_reason: error instanceof Error ? error.message.slice(0, 500) : "Unknown task creator error",
      }),
    }).catch(() => undefined);
  }
}
