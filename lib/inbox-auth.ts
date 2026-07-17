import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const INBOX_COOKIE = "nkh_inbox_session";
<<<<<<< HEAD
export type InboxRole = "ADMIN" | "TEAM";

export type InboxSession = {
  authenticated: true;
  role: InboxRole;
};

function sessionSecret() {
  const value = process.env.INBOX_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("INBOX_SESSION_SECRET must contain at least 32 characters");
  }
  return value;
}

function signature(expires: string, role: InboxRole) {
  return createHmac("sha256", sessionSecret())
    .update(`nkh-inbox:${expires}:${role}`)
    .digest("hex");
}

export function createInboxSession(role: InboxRole) {
  const expires = String(Date.now() + 12 * 60 * 60 * 1000);
  return `${expires}.${role}.${signature(expires, role)}`;
}

export function verifyInboxSession(token?: string | null): InboxSession | null {
  if (!token) return null;
  const [expires, rawRole, supplied] = token.split(".");
  if (!expires || !supplied || Number(expires) < Date.now()) return null;
  if (rawRole !== "ADMIN" && rawRole !== "TEAM") return null;
  const role: InboxRole = rawRole;
  const expected = signature(expires, role);
  if (expected.length !== supplied.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null;
  return { authenticated: true, role };
}

export async function getInboxSession() {
=======

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
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26
  const store = await cookies();
  return verifyInboxSession(store.get(INBOX_COOKIE)?.value);
}

<<<<<<< HEAD
export async function isInboxAuthenticated() {
  return Boolean(await getInboxSession());
}

export async function isInboxAdmin() {
  return (await getInboxSession())?.role === "ADMIN";
}

function safeEqual(expected: string, supplied: string) {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function validInboxCredentials(role: InboxRole, password: string) {
  const expected = role === "ADMIN"
    ? process.env.INBOX_ADMIN_PASSWORD
    : process.env.INBOX_TEAM_PASSWORD;
  return Boolean(expected && safeEqual(expected, password));
=======
export function validInboxPassword(password: string) {
  const expected = Buffer.from(secret());
  const supplied = Buffer.from(password);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
>>>>>>> ca9629391a316b7c3a31c127fc87b8e25b301d26
}
