import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { normalizeSeat, validSeat, HOLD_MINUTES } from "@/lib/seats";

// POST {zoneId, seats[]} → reserva 10 min. DELETE {holdId} → libera.
export async function POST(req: Request) {
  const body = z.object({ zoneId: z.string().uuid(), seats: z.array(z.string().min(1).max(20)).min(1).max(50) })
    .safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const sql = getDb();
  await sql`DELETE FROM seat_holds WHERE expires_at < now()`;
  const rows = await sql`SELECT z.*, e.status, e.max_per_order FROM zones z JOIN events e ON e.id=z.event_id
    WHERE z.id=${body.data.zoneId} LIMIT 1`;
  const zone = rows[0];
  if (!zone || zone.status !== "published") return NextResponse.json({ error: "Zona no disponible" }, { status: 400 });
  if (!Number(zone.seat_rows) || !Number(zone.seat_cols)) return NextResponse.json({ error: "Zona sin asientos numerados" }, { status: 400 });
  const seats = [...new Set(body.data.seats.map(normalizeSeat))].sort();
  if (seats.length > Math.max(1, Number(zone.max_per_order ?? 10))) {
    return NextResponse.json({ error: "Demasiados asientos para una compra" }, { status: 400 });
  }
  if (!seats.every((s) => validSeat(s, Number(zone.seat_rows), Number(zone.seat_cols)))) {
    return NextResponse.json({ error: "Asiento fuera del plano" }, { status: 400 });
  }
  const busy = await sql`SELECT seat FROM tickets WHERE zone_id=${body.data.zoneId} AND seat = ANY(${seats}) AND status IN ('valid','used')`;
  if (busy.length > 0) return NextResponse.json({ error: `Ocupado: ${busy.map((x) => String(x.seat)).join(", ")}` }, { status: 409 });
  const held = await sql`SELECT seat FROM seat_holds WHERE zone_id=${body.data.zoneId} AND seat = ANY(${seats}) AND expires_at > now()`;
  if (held.length > 0) return NextResponse.json({ error: `Reservado por otro comprador: ${held.map((x) => String(x.seat)).join(", ")}` }, { status: 409 });
  const holdId = randomUUID();
  const expires = new Date(Date.now() + HOLD_MINUTES * 60000).toISOString();
  try {
    for (const s of seats) {
      await sql`INSERT INTO seat_holds (hold_id, zone_id, seat, expires_at) VALUES (${holdId}, ${body.data.zoneId}, ${s}, ${expires})`;
    }
  } catch {
    await sql`DELETE FROM seat_holds WHERE hold_id=${holdId}`;
    return NextResponse.json({ error: "Alguien reservó esos asientos hace un instante. Elige otros." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, holdId, seats, expiresAt: expires });
}

export async function DELETE(req: Request) {
  const body = z.object({ holdId: z.string().uuid() }).safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const sql = getDb();
  await sql`DELETE FROM seat_holds WHERE hold_id=${body.data.holdId}`;
  await sql`DELETE FROM seat_holds WHERE expires_at < now()`;
  return NextResponse.json({ ok: true });
}
