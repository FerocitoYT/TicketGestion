import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const sql = getDb();
  const form = await req.formData();
  const eventId = String(form.get("eventId") || "");
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const title = String(form.get("title") || "").slice(0, 160) || "Sorteo";
  await sql`INSERT INTO raffles (event_id, title, prize, winners_count)
    VALUES (${eventId}, ${title}, ${String(form.get("prize") || "").slice(0, 200)}, ${Math.min(100, Math.max(1, Number(form.get("winners") || 1)))})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
