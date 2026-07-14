import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { to, text } = await request.json();
  if (!to || !text) return NextResponse.json({ error: "to and text are required" }, { status: 400 });
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return NextResponse.json({ demo: true, accepted: true, message: "Meta credentials are not connected yet." });
  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text } }),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
