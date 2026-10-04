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
  await sql`INSERT INTO promo_codes (event_id, code, pct_off, max_uses)
    VALUES (${eventId}, ${String(form.get("code") || "").toUpperCase().trim().slice(0, 32)}, ${Number(form.get("pct") || 0)}, ${Number(form.get("maxUses") || 0)})
    ON CONFLICT (event_id, code) DO NOTHING`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
