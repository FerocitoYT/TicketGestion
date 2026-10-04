import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

const Schema = z.object({
  name: z.string().min(2), email: z.string().email(),
  password: z.string().min(8), orgName: z.string().min(2),
});
function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "org";
}

export async function POST(req: Request) {
  const body = Schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { name, email, password, orgName } = body.data;
  const sql = getDb();
  const hash = await bcrypt.hash(password, 12);
  const slug = slugify(orgName) + "-" + Math.random().toString(36).slice(2, 6);
  try {
    const u = await sql`INSERT INTO users (name, email, password_hash) VALUES (${name}, ${email.toLowerCase()}, ${hash}) RETURNING id`;
    const o = await sql`INSERT INTO orgs (name, slug) VALUES (${orgName}, ${slug}) RETURNING id`;
    await sql`INSERT INTO memberships (user_id, org_id, role) VALUES (${u[0].id}, ${o[0].id}, 'owner')`;
    const token = createSessionToken({ userId: u[0].id as string, orgId: o[0].id as string, name, email, role: "owner", sessionVersion: 1 });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("duplicate") || msg.includes("unique")) return NextResponse.json({ error: "Ese email ya está registrado" }, { status: 409 });
    return NextResponse.json({ error: "No se pudo crear la cuenta" }, { status: 500 });
  }
}
