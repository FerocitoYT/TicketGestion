import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Crea (form) o borra (?delete) un turno de personal en un evento.
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const url = new URL(req.url);
  const sql = getDb();
  const form = await req.formData();
  const eventId = String(form.get("eventId") || "");
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  if (url.pathname.endsWith("/delete")) {
    await sql`DELETE FROM shifts WHERE id=${String(form.get("id") || "")} AND event_id=${eventId}`;
    return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
  }
  const userId = String(form.get("userId") || "");
  const m = await sql`SELECT user_id FROM memberships WHERE user_id=${userId} AND org_id=${s.orgId} LIMIT 1`;
  if (!m[0]) return NextResponse.json({ error: "No es de tu equipo" }, { status: 400 });
  const starts = String(form.get("startsAt") || "");
  if (!starts) return NextResponse.json({ error: "Falta inicio" }, { status: 400 });
  const ends = String(form.get("endsAt") || "");
  await sql`INSERT INTO shifts (event_id, user_id, post, starts_at, ends_at, notes)
    VALUES (${eventId}, ${userId}, ${String(form.get("post") || "Puerta").slice(0, 80)}, ${new Date(starts).toISOString()}, ${ends ? new Date(ends).toISOString() : null}, ${String(form.get("notes") || "").slice(0, 300)})`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.shift', ${JSON.stringify({ eventId, userId })})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
