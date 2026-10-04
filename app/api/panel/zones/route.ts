import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const form = await req.formData();
  const eventId = String(form.get("eventId") || "");
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const cents = Math.round(Number(form.get("price") || 0) * 100);
  await sql`INSERT INTO zones (event_id, name, price_cents, capacity)
    VALUES (${eventId}, ${String(form.get("name") || "").slice(0, 120)}, ${cents}, ${Number(form.get("capacity") || 0)})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
