import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Mapa público de una zona: dimensiones + asientos ocupados (vendidos o reservados).
// ?hold=holdId excluye la propia reserva (se pinta como elegida, no bloqueada).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownHold = new URL(req.url).searchParams.get("hold") || "";
  const sql = getDb();
  await sql`DELETE FROM seat_holds WHERE expires_at < now()`;
  const z = await sql`SELECT z.id, z.name, z.seat_rows, z.seat_cols, z.capacity, z.sold, e.status
    FROM zones z JOIN events e ON e.id=z.event_id WHERE z.id=${id} LIMIT 1`;
  if (!z[0] || z[0].status !== "published") return NextResponse.json({ error: "Zona no disponible" }, { status: 404 });
  const taken = await sql`SELECT seat FROM tickets WHERE zone_id=${id} AND seat <> '' AND status IN ('valid','used')`;
  const held = ownHold
    ? await sql`SELECT seat FROM seat_holds WHERE zone_id=${id} AND expires_at > now() AND hold_id <> ${ownHold}`
    : await sql`SELECT seat FROM seat_holds WHERE zone_id=${id} AND expires_at > now()`;
  return NextResponse.json({
    rows: Number(z[0].seat_rows), cols: Number(z[0].seat_cols),
    taken: taken.map((t) => String(t.seat)),
    held: held.map((t) => String(t.seat)),
  });
}
