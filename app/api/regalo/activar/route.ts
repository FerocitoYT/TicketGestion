import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

// Activa una entrada regalo con los datos del agasajado (página pública: el código es la prueba).
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!(await checkRateLimit(`gift:${ip}`, 10, 600))) {
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  }
  const b = z.object({
    code: z.string().trim().min(4).max(32),
    name: z.string().trim().min(2).max(120),
    doc: z.string().trim().min(3).max(40),
  }).safeParse(await req.json());
  if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const sql = getDb();
  const rows = await sql`SELECT t.*, e.title AS event, e.org_id FROM tickets t JOIN events e ON e.id=t.event_id
    WHERE t.code=${b.data.code.toUpperCase()} LIMIT 1`;
  const t = rows[0];
  if (!t) return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
  if (!t.is_gift) return NextResponse.json({ error: "Esta entrada ya está nominada" }, { status: 409 });
  if (t.status !== "valid") return NextResponse.json({ error: "Entrada no válida" }, { status: 409 });
  await sql`UPDATE tickets SET holder_name=${b.data.name}, holder_doc=${b.data.doc}, is_gift=false WHERE id=${t.id}`;
  await sql`INSERT INTO audit_events (org_id, action, meta) VALUES (${String(t.org_id)}, 'ticket.gift_claim', ${JSON.stringify({ code: t.code, to: b.data.name })})`;
  return NextResponse.json({ ok: true, event: String(t.event) });
}
