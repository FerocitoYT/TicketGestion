import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newTicketCode } from "@/lib/tickets";
import { randomBytes } from "crypto";

const Schema = z.object({
  eventId: z.string().uuid(),
  zoneId: z.string().uuid(),
  type: z.enum(["vip", "prensa", "invitado", "staff"]),
  qty: z.number().int().min(1).max(100),
  note: z.string().max(200).optional().default(""),
});

// Emite acreditaciones gratuitas (cupo) como entradas nominables en puerta.
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const b = Schema.safeParse(await req.json());
  if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const sql = getDb();
  const z = await sql`SELECT z.*, e.status FROM zones z JOIN events e ON e.id=z.event_id
    WHERE z.id=${b.data.zoneId} AND z.event_id=${b.data.eventId} AND e.org_id=${s.orgId} LIMIT 1`;
  if (!z[0] || z[0].status !== "published") return NextResponse.json({ error: "Zona no disponible" }, { status: 400 });
  if (Number(z[0].sold) + b.data.qty > Number(z[0].capacity)) {
    return NextResponse.json({ error: "Sin cupo suficiente en la zona" }, { status: 400 });
  }
  const upd = await sql`UPDATE zones SET sold = sold + ${b.data.qty}
    WHERE id=${b.data.zoneId} AND sold + ${b.data.qty} <= capacity RETURNING id`;
  if (!upd[0]) return NextResponse.json({ error: "Sin cupo suficiente" }, { status: 400 });
  const label = { vip: "VIP", prensa: "Prensa", invitado: "Invitado", staff: "Equipo" }[b.data.type];
  const o = await sql`INSERT INTO orders (event_id, zone_id, buyer_name, buyer_email, qty, total_cents, status, idempotency_key, kind, holders)
    VALUES (${b.data.eventId}, ${b.data.zoneId}, ${`Acreditación ${label}`}, '', ${b.data.qty}, 0, 'paid', ${randomBytes(16).toString("hex")}, 'acreditacion', '[]') RETURNING id`;
  const codes: string[] = [];
  for (let i = 0; i < b.data.qty; i++) {
    const code = newTicketCode();
    await sql`INSERT INTO tickets (order_id, event_id, zone_id, code, kind) VALUES (${o[0].id}, ${b.data.eventId}, ${b.data.zoneId}, ${code}, ${b.data.type})`;
    codes.push(code);
  }
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.accredit', ${JSON.stringify({ eventId: b.data.eventId, type: b.data.type, qty: b.data.qty, note: b.data.note })})`;
  return NextResponse.json({ ok: true, codes });
}
