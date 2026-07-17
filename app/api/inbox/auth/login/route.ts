import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { createInboxSession, InboxRole, INBOX_COOKIE, validInboxCredentials } from "@/lib/inbox-auth";

export async function POST(request: NextRequest) {
  const { role: rawRole, password } = await request.json();
  const role = String(rawRole ?? "").toUpperCase() as InboxRole;
  if ((role !== "ADMIN" && role !== "TEAM") || !password || !validInboxCredentials(role, String(password))) {
    return NextResponse.json({ error: "Incorrect role or password" }, { status: 401 });
  }
  const response = NextResponse.json({ authenticated: true, role });
  response.cookies.set(INBOX_COOKIE, createInboxSession(role), {
=======
import { createInboxSession, INBOX_COOKIE, validInboxPassword } from "@/lib/inbox-auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  if (!password || !validInboxPassword(String(password))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(INBOX_COOKIE, createInboxSession(), {
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return response;
}
