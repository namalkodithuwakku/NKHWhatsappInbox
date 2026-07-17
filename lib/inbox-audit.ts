import { supabaseRest } from "@/lib/supabase-server";
import { InboxRole } from "@/lib/inbox-auth";

export async function recordInboxAudit(input: {
  role: InboxRole;
  action: string;
  entityType: "conversation" | "property";
  entityId: string;
  details?: Record<string, unknown>;
}) {
  try {
    await supabaseRest("inbox_audit_logs", {
      method: "POST",
      body: JSON.stringify({
        actor_role: input.role,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        details: input.details ?? {},
      }),
    });
  } catch (error) {
    console.error("Inbox audit log could not be saved", error);
  }
}
