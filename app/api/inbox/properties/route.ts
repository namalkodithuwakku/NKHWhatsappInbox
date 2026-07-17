import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { getInboxSession, isInboxAuthenticated } from "@/lib/inbox-auth";
import { supabaseRest } from "@/lib/supabase-server";
import { recordInboxAudit } from "@/lib/inbox-audit";
=======
import { isInboxAuthenticated } from "@/lib/inbox-auth";
import { supabaseRest } from "@/lib/supabase-server";
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26

type PropertyRow = {
  id: string;
  client_code: string;
  property_name: string;
  preferred_language: string;
  client_status: string;
  package_name?: string | null;
  notes?: string | null;
};

type ContactInput = {
  id?: string;
  phone: string;
  name_prefix?: string;
  contact_name?: string;
  job_position?: string;
  is_active?: boolean;
  notes?: string;
};

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function GET() {
  if (!(await isInboxAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [properties, contacts] = await Promise.all([
      supabaseRest<PropertyRow[]>("nkh_properties?select=*&order=client_code.asc"),
      supabaseRest<Array<Record<string, unknown>>>("wa_contacts?select=*&order=created_at.asc"),
    ]);
    return NextResponse.json({
      properties: properties.map((property) => ({
        ...property,
        contacts: contacts.filter((contact) => contact.property_id === property.id),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load properties" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isInboxAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const clientCode = String(body.client_code ?? "").trim().toUpperCase();
  const propertyName = String(body.property_name ?? "").trim();
  const contacts: ContactInput[] = Array.isArray(body.contacts) ? body.contacts : [];
  if (!/^NKH\d{3,}$/.test(clientCode)) return NextResponse.json({ error: "Use a valid client code such as NKH001" }, { status: 400 });
  if (!propertyName) return NextResponse.json({ error: "Property name is required" }, { status: 400 });
  if (contacts.length === 0) return NextResponse.json({ error: "Add at least one WhatsApp number" }, { status: 400 });

  const normalized = contacts.map((contact) => ({ ...contact, wa_id: normalizePhone(String(contact.phone ?? "")) }));
  if (normalized.some((contact) => contact.wa_id.length < 8 || contact.wa_id.length > 15)) {
    return NextResponse.json({ error: "Enter each number with country code, for example +94771234567" }, { status: 400 });
  }
  if (new Set(normalized.map((contact) => contact.wa_id)).size !== normalized.length) {
    return NextResponse.json({ error: "The same phone number is entered more than once" }, { status: 400 });
  }

  try {
    const propertyRows = await supabaseRest<PropertyRow[]>("nkh_properties?on_conflict=client_code", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        client_code: clientCode,
        property_name: propertyName,
        preferred_language: body.preferred_language || "English",
        client_status: body.client_status || "Active",
        package_name: String(body.package_name ?? "").trim() || null,
        notes: String(body.notes ?? "").trim() || null,
      }),
    });
    const property = propertyRows[0];

    for (const contact of normalized) {
      const existing = await supabaseRest<Array<{ id: string; property_id?: string | null }>>(`wa_contacts?wa_id=eq.${contact.wa_id}&select=id,property_id`);
      if (existing[0]?.property_id && existing[0].property_id !== property.id) {
        return NextResponse.json({ error: `+${contact.wa_id} is already linked to another property` }, { status: 409 });
      }
      await supabaseRest("wa_contacts?on_conflict=wa_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          wa_id: contact.wa_id,
          phone: `+${contact.wa_id}`,
          property_id: property.id,
          name_prefix: String(contact.name_prefix ?? "").trim() || null,
          contact_name: String(contact.contact_name ?? "").trim() || null,
          profile_name: String(contact.contact_name ?? "").trim() || null,
          job_position: String(contact.job_position ?? "").trim() || null,
          is_active: contact.is_active !== false,
          notes: String(contact.notes ?? "").trim() || null,
          property_name: property.property_name,
          client_status: property.client_status === "Active" ? "Existing Client" : property.client_status,
        }),
      });
    }
    return NextResponse.json({ success: true, property_id: property.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save property" }, { status: 500 });
  }
}
<<<<<<< HEAD

export async function DELETE(request: NextRequest) {
  const session = await getInboxSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Property id required" }, { status: 400 });
  const encodedId = encodeURIComponent(id);
  try {
    const properties = await supabaseRest<PropertyRow[]>(`nkh_properties?id=eq.${encodedId}&select=*`);
    const property = properties[0];
    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });
    const contacts = await supabaseRest<Array<{ id: string }>>(`wa_contacts?property_id=eq.${encodedId}&select=id`);
    for (const contact of contacts) {
      const contactId = encodeURIComponent(contact.id);
      const conversations = await supabaseRest<Array<{ id: string }>>(`wa_conversations?contact_id=eq.${contactId}&select=id`);
      for (const conversation of conversations) {
        const conversationId = encodeURIComponent(conversation.id);
        await supabaseRest(`wa_internal_notes?conversation_id=eq.${conversationId}`, { method: "DELETE" });
        await supabaseRest(`wa_messages?conversation_id=eq.${conversationId}`, { method: "DELETE" });
      }
      await supabaseRest(`wa_conversations?contact_id=eq.${contactId}`, { method: "DELETE" });
    }
    await supabaseRest(`wa_contacts?property_id=eq.${encodedId}`, { method: "DELETE" });
    await supabaseRest(`nkh_properties?id=eq.${encodedId}`, { method: "DELETE" });
    await recordInboxAudit({
      role: session.role,
      action: "delete",
      entityType: "property",
      entityId: id,
      details: { client_code: property.client_code, property_name: property.property_name, contacts_deleted: contacts.length },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 500 });
  }
}
=======
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26
