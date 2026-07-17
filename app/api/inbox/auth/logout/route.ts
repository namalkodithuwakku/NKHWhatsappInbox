import { NextResponse } from "next/server";
import { INBOX_COOKIE } from "@/lib/inbox-auth";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(INBOX_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
