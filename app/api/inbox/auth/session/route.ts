import { NextResponse } from "next/server";
import { getInboxSession } from "@/lib/inbox-auth";

export async function GET() {
  const session = await getInboxSession();
  return NextResponse.json(session ?? { authenticated: false, role: null });
}
