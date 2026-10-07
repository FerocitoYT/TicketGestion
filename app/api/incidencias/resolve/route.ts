import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const sql = getDb();
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const eventId = String(form.get("eventId") || "");
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  await sql`UPDATE incidents SET status='resuelta', resolved_at=now() WHERE id=${id} AND event_id=${eventId}`;
  const back = req.headers.get("referer") || `/panel/${eventId}`;
  return NextResponse.redirect(new URL(back.split("?")[0], req.url), 303);
}
