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
  dashboard_task_id?: string | null;
};

export async function GET(request: NextRequest) {
  if (!(await isInboxAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversation_id");
  if (!conversationId) return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
  try {
    const rows = await supabaseRest<ClientRequest[]>(
      `wa_client_requests?conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=created_at.desc&limit=30`,
    );
    const taskIds = rows.map(row => row.dashboard_task_id).filter(Boolean) as string[];
    if (taskIds.length) {
      try {
        const links = await supabaseRest<Array<{dashboard_task_id:string;task_status:string;assigned_to?:string|null;completion_note?:string|null}>>(
          `wa_task_links?dashboard_task_id=in.(${taskIds.map(id => encodeURIComponent(id)).join(",")})&select=dashboard_task_id,task_status,assigned_to,completion_note`
        );
        const byId = new Map(links.map(link => [link.dashboard_task_id, link]));
        for (const row of rows) {
          const link = row.dashboard_task_id ? byId.get(row.dashboard_task_id) : undefined;
          if (!link) continue;
          const mapped = /done|complete/i.test(link.task_status) ? "Completed" : /progress/i.test(link.task_status) ? "In progress" : /waiting/i.test(link.task_status) ? "Waiting" : "Open";
          row.status = mapped;
          row.assigned_to = link.assigned_to || row.assigned_to;
          row.completion_note = link.completion_note || row.completion_note;
        }
      } catch (error) {
        console.error("Dashboard task status sync unavailable", error);
      }
    }
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
    const current = await supabaseRest<ClientRequest[]>(`wa_client_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const row = current[0];
    if (!row) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    if (status === "Completed" && row.dashboard_task_id) {
      const dashboardUrl = process.env.DASHBOARD_TASK_API_URL;
      const secret = process.env.INBOX_INTEGRATION_SECRET;
      if (!dashboardUrl || !secret) return NextResponse.json({ error: "Dashboard task integration is not configured" }, { status: 503 });
      const response = await fetch(dashboardUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-nkh-inbox-secret": secret },
        body: JSON.stringify({ taskId: row.dashboard_task_id, staffName: assigned_to || row.assigned_to || "NKH Team", completionNote: completion_note || "" }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) return NextResponse.json({ error: data.error || "Dashboard task completion failed" }, { status: 502 });
    }

    await supabaseRest(`wa_client_requests?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request update failed" }, { status: 500 });
  }
}
