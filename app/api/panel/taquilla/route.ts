import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newTicketCode } from "@/lib/tickets";
import { parseHolders } from "@/lib/holders";
import { normalizeSeat, validSeat } from "@/lib/seats";
import { randomBytes } from "crypto";

const Schema = z.object({
  eventId: z.string().uuid(),
  zoneId: z.string().uuid(),
  qty: z.number().int().min(1).max(50),
  buyerName: z.string().trim().min(2).max(120),
  buyerEmail: z.string().trim().max(160).optional().default(""),
  holders: z.string().max(2000).optional().default(""),
  seats: z.array(z.string().min(1).max(20)).max(50).optional().default([]),
  method: z.enum(["efectivo", "tarjeta", "datofono"]),
});

// Venta presencial en taquilla: cobra fuera de Stripe y emite al instante.
// Respeta aforo, límites del evento y asientos (sin reserva previa: es venta directa).
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const b = Schema.safeParse(await req.json());
  if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const sql = getDb();
  const zones = await sql`SELECT z.*, e.title, e.status, e.max_per_order, e.max_per_buyer FROM zones z JOIN events e ON e.id=z.event_id
    WHERE z.id=${b.data.zoneId} AND z.event_id=${b.data.eventId} AND e.org_id=${s.orgId} LIMIT 1`;
  if (!zones[0] || zones[0].status !== "published") return NextResponse.json({ error: "Zona no disponible" }, { status: 400 });
  const maxOrder = Math.max(1, Number(zones[0].max_per_order ?? 10));
  if (b.data.qty > maxOrder) return NextResponse.json({ error: `Máximo ${maxOrder} por venta` }, { status: 400 });
  if (Number(zones[0].sold) + b.data.qty > Number(zones[0].capacity)) {
    return NextResponse.json({ error: "Sin stock suficiente" }, { status: 400 });
  }
  const email = b.data.buyerEmail.toLowerCase();
  if (email && !email.includes("@")) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  const maxBuyer = Number(zones[0].max_per_buyer ?? 0);
  if (email && maxBuyer > 0) {
    const prev = await sql`SELECT COALESCE(SUM(qty),0) AS n FROM orders WHERE event_id=${b.data.eventId} AND buyer_email=${email} AND status IN ('pending','paid')`;
    if (Number(prev[0].n) + b.data.qty > maxBuyer) {
      return NextResponse.json({ error: `Ese email ya tiene ${Number(prev[0].n)} entradas (máx ${maxBuyer})` }, { status: 400 });
    }
  }
  const mapped = Number(zones[0].seat_rows) > 0;
  let seats: string[] = [];
  if (mapped) {
    seats = [...new Set(b.data.seats.map(normalizeSeat))].sort();
    if (seats.length !== b.data.qty) return NextResponse.json({ error: "Indica un asiento por entrada" }, { status: 400 });
    if (!seats.every((x) => validSeat(x, Number(zones[0].seat_rows), Number(zones[0].seat_cols)))) {
      return NextResponse.json({ error: "Asiento fuera del plano" }, { status: 400 });
    }
    const busy = await sql`SELECT seat FROM tickets WHERE zone_id=${b.data.zoneId} AND seat = ANY(${seats}) AND status IN ('valid','used')`;
    if (busy.length > 0) return NextResponse.json({ error: `Ocupado: ${busy.map((x) => String(x.seat)).join(", ")}` }, { status: 409 });
    const held = await sql`SELECT seat FROM seat_holds WHERE zone_id=${b.data.zoneId} AND seat = ANY(${seats}) AND expires_at > now()`;
    if (held.length > 0) return NextResponse.json({ error: `Reservado online: ${held.map((x) => String(x.seat)).join(", ")}` }, { status: 409 });
  }
  const holders = parseHolders(b.data.holders, b.data.qty, b.data.buyerName);
  if (mapped) for (let i = 0; i < b.data.qty; i++) holders[i].seat = seats[i];
  const unit = Number(zones[0].price_cents);
  const total = unit * b.data.qty;
  const upd = await sql`UPDATE zones SET sold = sold + ${b.data.qty} WHERE id=${b.data.zoneId} AND sold + ${b.data.qty} <= capacity RETURNING id`;
  if (!upd[0]) return NextResponse.json({ error: "Sin stock suficiente" }, { status: 400 });
  const o = await sql`INSERT INTO orders (event_id, zone_id, buyer_name, buyer_email, qty, total_cents, status, idempotency_key, holders, kind, payment_method)
    VALUES (${b.data.eventId}, ${b.data.zoneId}, ${b.data.buyerName}, ${email}, ${b.data.qty}, ${total}, 'paid', ${randomBytes(16).toString("hex")}, ${JSON.stringify(holders)}, 'taquilla', ${b.data.method}) RETURNING id`;
  const codes: string[] = [];
  try {
    for (let i = 0; i < b.data.qty; i++) {
      const code = newTicketCode();
      await sql`INSERT INTO tickets (order_id, event_id, zone_id, code, holder_name, holder_doc, seat)
        VALUES (${o[0].id}, ${b.data.eventId}, ${b.data.zoneId}, ${code}, ${holders[i].name}, ${holders[i].doc}, ${holders[i].seat})`;
      codes.push(code);
    }
  } catch {
    await sql`DELETE FROM tickets WHERE order_id=${o[0].id}`;
    await sql`UPDATE orders SET status='cancelled' WHERE id=${o[0].id}`;
    await sql`UPDATE zones SET sold = sold - ${b.data.qty} WHERE id=${b.data.zoneId}`;
    return NextResponse.json({ error: "Un asiento se ocupó a la vez. Elige otros." }, { status: 409 });
  }
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'order.taquilla', ${JSON.stringify({ orderId: o[0].id, method: b.data.method, total })})`;
  return NextResponse.json({ ok: true, codes, total });
}
