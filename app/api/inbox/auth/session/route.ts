import { NextResponse } from "next/server";
<<<<<<< HEAD
import { getInboxSession } from "@/lib/inbox-auth";

export async function GET() {
  const session = await getInboxSession();
  return NextResponse.json(session ?? { authenticated: false, role: null });
=======
import { isInboxAuthenticated } from "@/lib/inbox-auth";

export async function GET() {
  return NextResponse.json({ authenticated: await isInboxAuthenticated() });
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26
}
