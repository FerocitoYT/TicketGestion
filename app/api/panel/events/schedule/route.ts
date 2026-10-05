import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso: solo propietario o equipo" }, { status: 403 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${id} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const raw = String(form.get("endsAt") || "");
  await sql`UPDATE events SET ends_at=${raw ? new Date(raw).toISOString() : null} WHERE id=${id}`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.schedule', ${JSON.stringify({ id, raw })})`;
  return NextResponse.redirect(new URL(`/panel/${id}`, req.url), 303);
}
