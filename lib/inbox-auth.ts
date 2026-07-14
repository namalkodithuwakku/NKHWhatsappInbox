import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const INBOX_COOKIE = "nkh_inbox_session";

function secret() {
  const value = process.env.INBOX_ACCESS_PASSWORD;
  if (!value) throw new Error("INBOX_ACCESS_PASSWORD is not configured");
  return value;
}

function signature(expires: string) {
  return createHmac("sha256", secret()).update(`nkh-inbox:${expires}`).digest("hex");
}

export function createInboxSession() {
  const expires = String(Date.now() + 12 * 60 * 60 * 1000);
  return `${expires}.${signature(expires)}`;
}

export function verifyInboxSession(token?: string | null) {
  if (!token) return false;
  const [expires, supplied] = token.split(".");
  if (!expires || !supplied || Number(expires) < Date.now()) return false;
  const expected = signature(expires);
  if (expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function isInboxAuthenticated() {
  const store = await cookies();
  return verifyInboxSession(store.get(INBOX_COOKIE)?.value);
}

export function validInboxPassword(password: string) {
  const expected = Buffer.from(secret());
  const supplied = Buffer.from(password);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
