import { NextRequest, NextResponse } from "next/server";
import { createInboxSession, INBOX_COOKIE, validInboxPassword } from "@/lib/inbox-auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  if (!password || !validInboxPassword(String(password))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(INBOX_COOKIE, createInboxSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return response;
}
