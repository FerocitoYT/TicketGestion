import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const Schema = z.object({
  code: z.string().trim().min(4).max(32),
  email: z.string().email().max(160),
  name: z.string().trim().min(2).max(120),
  doc: z.string().trim().min(3).max(40),
});

// Transfiere el titular de una entrada. Prueba de propiedad: código + email de compra.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!(await checkRateLimit(`transfer:${ip}`, 10, 600))) {
    return NextResponse.json({ error: "Demasiados intentos, espera unos minutos" }, { status: 429 });
  }
  const b = Schema.safeParse(await req.json());
  if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const sql = getDb();
  const rows = await sql`
    SELECT t.*, o.buyer_email, o.buyer_name, e.org_id, e.title AS event
    FROM tickets t JOIN orders o ON o.id=t.order_id JOIN events e ON e.id=t.event_id
    WHERE t.code=${b.data.code.toUpperCase()} LIMIT 1`;
  const t = rows[0] as Record<string, unknown> | undefined;
  if (!t) return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
  if (String(t.buyer_email).toLowerCase() !== b.data.email.toLowerCase()) {
    return NextResponse.json({ error: "El email no coincide con el de compra" }, { status: 403 });
  }
  if (t.status !== "valid") {
    return NextResponse.json({ error: "Solo se pueden transferir entradas válidas (no usadas ni canceladas)" }, { status: 409 });
  }
  await sql`UPDATE tickets SET holder_name=${b.data.name}, holder_doc=${b.data.doc} WHERE id=${String(t.id)}`;
  await sql`INSERT INTO audit_events (org_id, action, meta) VALUES (${String(t.org_id)}, 'ticket.transfer', ${JSON.stringify({ code: t.code, from: t.holder_name, to: b.data.name })})`;
  return NextResponse.json({ ok: true, holder: b.data.name });
}
