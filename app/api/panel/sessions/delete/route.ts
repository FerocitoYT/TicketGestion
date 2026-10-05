import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const eventId = String(form.get("eventId") || "");
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const used = await sql`SELECT COUNT(*) AS n FROM tickets t JOIN zones z ON z.id=t.zone_id WHERE z.session_id=${id}`;
  if (Number(used[0]?.n || 0) > 0) return NextResponse.json({ error: "No se puede borrar: la sesión ya tiene entradas vendidas" }, { status: 409 });
  const count = await sql`SELECT COUNT(*) AS n FROM sessions WHERE event_id=${eventId}`;
  if (Number(count[0]?.n || 0) <= 1) return NextResponse.json({ error: "El evento necesita al menos una sesión" }, { status: 409 });
  await sql`DELETE FROM sessions WHERE id=${id} AND event_id=${eventId}`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
