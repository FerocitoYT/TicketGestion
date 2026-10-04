import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Guarda la asignación de personal de puerta a un evento (checkboxes userIds).
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const form = await req.formData();
  const eventId = String(form.get("eventId") || "");
  const userIds = form.getAll("userIds").map(String);
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  // Solo miembros de la org pueden asignarse.
  const members = await sql`SELECT user_id FROM memberships WHERE org_id=${s.orgId}`;
  const valid = new Set(members.map((m) => String(m.user_id)));
  const clean = [...new Set(userIds)].filter((u) => valid.has(u));
  await sql`DELETE FROM event_staff WHERE event_id=${eventId}`;
  for (const u of clean) {
    await sql`INSERT INTO event_staff (event_id, user_id) VALUES (${eventId}, ${u}) ON CONFLICT DO NOTHING`;
  }
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.staff', ${JSON.stringify({ eventId, count: clean.length })})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
