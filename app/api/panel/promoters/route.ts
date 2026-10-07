import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Crea un promotor con su código, % comisión y % descuento para sus compradores.
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const form = await req.formData();
  const eventId = String(form.get("eventId") || "");
  const name = String(form.get("name") || "").slice(0, 120);
  const code = String(form.get("code") || "").toUpperCase().trim().slice(0, 32);
  const commission = Math.min(100, Math.max(0, Number(form.get("commission") || 10)));
  const discount = Math.min(100, Math.max(0, Number(form.get("discount") || 0)));
  if (!name || !code) return NextResponse.json({ error: "Nombre y código requeridos" }, { status: 400 });
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  await sql`INSERT INTO promoters (event_id, name, code, commission_pct, discount_pct)
    VALUES (${eventId}, ${name}, ${code}, ${commission}, ${discount}) ON CONFLICT (event_id, code) DO NOTHING`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.promoter', ${JSON.stringify({ eventId, code })})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
