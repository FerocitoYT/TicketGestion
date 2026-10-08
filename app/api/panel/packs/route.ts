import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Crea (form) o borra (?delete) un pack de grupo del evento.
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
    await sql`DELETE FROM packs WHERE id=${String(form.get("id") || "")} AND event_id=${eventId}`;
    return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
  }
  const zoneId = String(form.get("zoneId") || "");
  const zn = await sql`SELECT id FROM zones WHERE id=${zoneId} AND event_id=${eventId} LIMIT 1`;
  if (!zn[0]) return NextResponse.json({ error: "Zona no válida" }, { status: 400 });
  const name = String(form.get("name") || "").slice(0, 120);
  const qty = Math.min(50, Math.max(2, Number(form.get("qty") || 2)));
  const price = Math.round(Number(form.get("price") || 0) * 100);
  if (!name || price < 0) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  await sql`INSERT INTO packs (event_id, zone_id, name, qty, price_cents, max_uses)
    VALUES (${eventId}, ${zoneId}, ${name}, ${qty}, ${price}, ${Math.max(0, Number(form.get("maxUses") || 0))})`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.pack', ${JSON.stringify({ eventId, name })})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
