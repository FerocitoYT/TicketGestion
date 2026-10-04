import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

const Schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  password: z.string().min(8).max(200),
  role: z.enum(["staff", "scanner"]),
});

// Solo el propietario crea cuentas de personal (puerta/equipo).
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Login requerido" }, { status: 401 });
  if (s.role !== "owner") return NextResponse.json({ error: "Solo el propietario gestiona el personal" }, { status: 403 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { name, email, password, role } = parsed.data;
  const sql = getDb();
  const hash = await bcrypt.hash(password, 12);
  let userId: string;
  const existing = await sql`SELECT id FROM users WHERE email=${email.toLowerCase()} LIMIT 1`;
  if (existing[0]) {
    userId = existing[0].id as string;
  } else {
    const u = await sql`INSERT INTO users (name, email, password_hash) VALUES (${name}, ${email.toLowerCase()}, ${hash}) RETURNING id`;
    userId = u[0].id as string;
  }
  await sql`INSERT INTO memberships (user_id, org_id, role) VALUES (${userId}, ${s.orgId}, ${role})
    ON CONFLICT (user_id, org_id) DO UPDATE SET role=EXCLUDED.role`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'staff.add', ${JSON.stringify({ email, role })})`;
  return NextResponse.json({ ok: true });
}
