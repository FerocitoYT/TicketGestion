import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { authSecret } from "@/lib/secret";

export const SESSION_COOKIE = "tg_session";
export type Session = {
  userId: string;
  orgId: string;
  name: string;
  email: string;
  role: string;
  sessionVersion: number;
  exp: number;
};

function sign(v: string) {
  return createHmac("sha256", authSecret()).update(v).digest("base64url");
}
export function encodeSigned(payload: object) {
  const e = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return e + "." + sign(e);
}
export function decodeSigned<T>(token?: string | null): T | null {
  if (!token) return null;
  const [e, s] = token.split(".");
  if (!e || !s) return null;
  const exp = sign(e);
  const a = Buffer.from(s);
  const b = Buffer.from(exp);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(e, "base64url").toString()) as T;
  } catch {
    return null;
  }
}
export function createSessionToken(p: Omit<Session, "exp">) {
  return encodeSigned({ ...p, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 });
}
export function verifySessionToken(t?: string | null): Session | null {
  const p = decodeSigned<Session>(t);
  if (!p?.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
  return p;
}
export async function getSession() {
  const store = await cookies();
  const payload = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  try {
    const sql = getDb();
    const rows = await sql`SELECT session_version FROM users WHERE id=${payload.userId} LIMIT 1`;
    if (!rows[0] || Number(rows[0].session_version) !== payload.sessionVersion) return null;
    return payload;
  } catch (e) {
    console.error("session-validation", e);
    return null;
  }
}
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

// Puerta de rol: devuelve la sesión solo si el rol está permitido.
export async function requireRole(allowed: string[]): Promise<Session | null> {
  const s = await getSession();
  if (!s || !allowed.includes(s.role)) return null;
  return s;
}
