import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const url = new URL(req.url);
  const sql = getDb();
  const form = await req.formData();
  const eventId = String(form.get("eventId") || "");
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const starts = String(form.get("startsAt") || "");
  if (!starts) return NextResponse.json({ error: "Falta fecha" }, { status: 400 });
  const ends = String(form.get("endsAt") || "");
  const sess = await sql`INSERT INTO sessions (event_id, starts_at, ends_at) VALUES (${eventId}, ${new Date(starts).toISOString()}, ${ends ? new Date(ends).toISOString() : null}) RETURNING id`;
  // Hereda las zonas de la primera sesión para no empezar de cero (aforo a configurar).
  const tpl = await sql`SELECT name, price_cents, capacity, seat_rows, seat_cols FROM zones WHERE event_id=${eventId} ORDER BY created_at ASC LIMIT 20`;
  const first = await sql`SELECT id FROM sessions WHERE event_id=${eventId} ORDER BY created_at ASC LIMIT 1`;
  if (first[0] && String(first[0].id) !== String(sess[0].id) && tpl.length > 0) {
    for (const z of tpl) {
      await sql`INSERT INTO zones (event_id, session_id, name, price_cents, capacity, seat_rows, seat_cols)
        VALUES (${eventId}, ${sess[0].id}, ${String(z.name)}, ${Number(z.price_cents)}, ${Number(z.capacity)}, ${Number(z.seat_rows)}, ${Number(z.seat_cols)})`;
    }
  }
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.session_add', ${JSON.stringify({ eventId })})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
