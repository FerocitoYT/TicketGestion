import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Crea o actualiza la pregunta de la encuesta del evento.
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const form = await req.formData();
  const eventId = String(form.get("eventId") || "");
  const question = String(form.get("question") || "").slice(0, 200) || "¿Cómo valorarías este evento?";
  const active = String(form.get("active") || "1") === "1";
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const ex = await sql`SELECT id FROM surveys WHERE event_id=${eventId} LIMIT 1`;
  if (ex[0]) {
    await sql`UPDATE surveys SET question=${question}, active=${active} WHERE id=${ex[0].id}`;
  } else {
    await sql`INSERT INTO surveys (event_id, question, active) VALUES (${eventId}, ${question}, ${active})`;
  }
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
