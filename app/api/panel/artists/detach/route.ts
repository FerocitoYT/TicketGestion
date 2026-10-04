import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const b = z.object({ eventId: z.string().uuid(), artistId: z.string().uuid() }).safeParse(await req.json());
  if (!b.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${b.data.eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  await sql`DELETE FROM event_artists WHERE event_id=${b.data.eventId} AND artist_id=${b.data.artistId}`;
  return NextResponse.json({ ok: true });
}
