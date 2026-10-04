import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(await req.json());
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!(await checkRateLimit(`login:${ip}`, 10, 300))) return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  const sql = getDb();
  const rows = await sql`SELECT u.*, m.org_id, m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.email=${email.toLowerCase()} LIMIT 1`;
  if (!rows[0]) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  const ok = await bcrypt.compare(password, rows[0].password_hash as string);
  if (!ok) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  const token = createSessionToken({
    userId: rows[0].user_id as string, orgId: rows[0].org_id as string,
    name: rows[0].name as string, email: rows[0].email as string,
    role: rows[0].role as string, sessionVersion: Number(rows[0].session_version),
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
