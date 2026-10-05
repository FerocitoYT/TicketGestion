import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Mapa público de una zona: dimensiones + asientos ocupados (para pintar el plano).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sql = getDb();
  const z = await sql`SELECT z.id, z.name, z.seat_rows, z.seat_cols, z.capacity, z.sold, e.status
    FROM zones z JOIN events e ON e.id=z.event_id WHERE z.id=${id} LIMIT 1`;
  if (!z[0] || z[0].status !== "published") return NextResponse.json({ error: "Zona no disponible" }, { status: 404 });
  const taken = await sql`SELECT seat FROM tickets WHERE zone_id=${id} AND seat <> '' AND status IN ('valid','used')`;
  return NextResponse.json({
    rows: Number(z[0].seat_rows), cols: Number(z[0].seat_cols),
    taken: taken.map((t) => String(t.seat)),
  });
}
