import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Info práctica del evento: transporte y parking.
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${id} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  await sql`UPDATE events SET transport=${String(form.get("transport") || "").slice(0, 1000)}, parking=${String(form.get("parking") || "").slice(0, 1000)} WHERE id=${id}`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.info', ${JSON.stringify({ id })})`;
  return NextResponse.redirect(new URL(`/panel/${id}`, req.url), 303);
}
