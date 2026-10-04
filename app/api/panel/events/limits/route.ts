import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Límites del evento: máx por compra y máx por comprador (0 = sin límite).
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${id} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const perOrder = Math.min(50, Math.max(1, Number(form.get("maxPerOrder") || 10)));
  const perBuyer = Math.max(0, Number(form.get("maxPerBuyer") || 0));
  await sql`UPDATE events SET max_per_order=${perOrder}, max_per_buyer=${perBuyer} WHERE id=${id}`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.limits', ${JSON.stringify({ id, perOrder, perBuyer })})`;
  return NextResponse.redirect(new URL(`/panel/${id}`, req.url), 303);
}
