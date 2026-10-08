import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Sortea entre entradas con acceso validado (una participación por entrada).
export async function POST(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const sql = getDb();
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const eventId = String(form.get("eventId") || "");
  const ev = await sql`SELECT id FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const r = await sql`SELECT * FROM raffles WHERE id=${id} AND event_id=${eventId} LIMIT 1`;
  if (!r[0]) return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
  const pool = await sql`
    SELECT DISTINCT ON (t.id) t.id
    FROM scans sc JOIN tickets t ON t.id=sc.ticket_id
    WHERE sc.event_id=${eventId} AND sc.result='ok' AND t.status='used'
    ORDER BY t.id, sc.created_at ASC LIMIT 5000`;
  if (pool.length === 0) return NextResponse.json({ error: "Aún no hay asistentes validados" }, { status: 400 });
  const n = Math.min(Number(r[0].winners_count), pool.length);
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
  await sql`DELETE FROM raffle_winners WHERE raffle_id=${id}`;
  for (const w of shuffled) {
    await sql`INSERT INTO raffle_winners (raffle_id, ticket_id) VALUES (${id}, ${w.id}) ON CONFLICT DO NOTHING`;
  }
  await sql`UPDATE raffles SET status='drawn', drawn_at=now() WHERE id=${id}`;
  await sql`INSERT INTO audit_events (org_id, actor_id, action, meta) VALUES (${s.orgId}, ${s.userId}, 'event.raffle', ${JSON.stringify({ eventId, winners: n })})`;
  return NextResponse.redirect(new URL(`/panel/${eventId}`, req.url), 303);
}
