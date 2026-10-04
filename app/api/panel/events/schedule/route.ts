import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Login" }, { status: 401 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const sql = getDb();
  const ev = await sql`SELECT id FROM events WHERE id=${id} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const raw = String(form.get("endsAt") || "");
  const grace = Math.min(1440, Math.max(0, Number(form.get("grace") || 120)));
  await sql`UPDATE events SET ends_at=${raw ? new Date(raw).toISOString() : null}, access_grace_minutes=${grace} WHERE id=${id}`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.schedule', ${JSON.stringify({ id, raw, grace })})`;
  return NextResponse.redirect(new URL(`/panel/${id}`, req.url), 303);
}
