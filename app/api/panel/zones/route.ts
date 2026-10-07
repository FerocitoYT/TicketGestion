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
  const sessionId = String(form.get("sessionId") || "");
  const ses = await sql`SELECT id FROM sessions WHERE id=${sessionId} AND event_id=${eventId} LIMIT 1`;
  if (!ses[0]) return NextResponse.json({ error: "Sesión no válida" }, { status: 400 });
  const rows = Math.min(40, Math.max(0, Number(form.get("seatRows") || 0)));
  const cols = Math.min(60, Math.max(0, Number(form.get("seatCols") || 0)));
  const accessible = String(form.get("accessible") || "") === "on";
  const companionFree = String(form.get("companionFree") || "") !== "off";
  await sql`INSERT INTO zones (event_id, session_id, name, price_cents, capacity, seat_rows, seat_cols, accessible, companion_free)
    VALUES (${eventId}, ${sessionId}, ${String(form.get("name") || "").slice(0, 120)}, ${cents}, ${Number(form.get("capacity") || 0)}, ${rows}, ${cols}, ${accessible}, ${companionFree})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
