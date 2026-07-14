import { NextResponse } from "next/server";
import { isInboxAuthenticated } from "@/lib/inbox-auth";

export async function GET() {
  return NextResponse.json({ authenticated: await isInboxAuthenticated() });
}
