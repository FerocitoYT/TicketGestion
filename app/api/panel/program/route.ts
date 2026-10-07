import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const sql = getDb();
  const form = await req.formData();
  const eventId = String(form.get("eventId") || "");
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const sessionId = String(form.get("sessionId") || "") || null;
  if (sessionId) {
    const ss = await sql`SELECT id FROM sessions WHERE id=${sessionId} AND event_id=${eventId} LIMIT 1`;
    if (!ss[0]) return NextResponse.json({ error: "Sesión no válida" }, { status: 400 });
  }
  const starts = String(form.get("startsAt") || "");
  const title = String(form.get("title") || "").slice(0, 160);
  if (!starts || !title) return NextResponse.json({ error: "Hora y título requeridos" }, { status: 400 });
  const artistId = String(form.get("artistId") || "") || null;
  await sql`INSERT INTO program_slots (event_id, session_id, artist_id, starts_at, title, description)
    VALUES (${eventId}, ${sessionId}, ${artistId}, ${new Date(starts).toISOString()}, ${title}, ${String(form.get("description") || "").slice(0, 500)})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
