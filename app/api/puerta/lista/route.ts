import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { accessState, type AccessEvent } from "@/lib/access";

// Lista offline: entradas válidas/usadas de los eventos operativos del personal.
// Descargar con internet antes de puerta; sin internet se valida contra esta lista.
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Login requerido" }, { status: 401 });
  const sql = getDb();
  const evs = s.role === "owner"
    ? await sql`SELECT id, title, status, starts_at, ends_at, access_grace_minutes, access_closed FROM events WHERE org_id=${s.orgId} AND status='published'`
    : await sql`SELECT e.id, e.title, e.status, e.starts_at, e.ends_at, e.access_grace_minutes, e.access_closed
        FROM event_staff es JOIN events e ON e.id=es.event_id
        WHERE es.user_id=${s.userId} AND e.org_id=${s.orgId} AND e.status='published'`;
  const openIds = (evs as unknown as AccessEvent[]).filter((e) => accessState(e).open).map((e) => e.id);
  if (openIds.length === 0) return NextResponse.json({ at: new Date().toISOString(), events: [], tickets: [] });
  const tickets = await sql`
    SELECT t.code, t.holder_name, t.holder_doc, t.seat, t.status, z.name AS zone, e.id AS event_id, e.title AS event
    FROM tickets t JOIN zones z ON z.id=t.zone_id JOIN events e ON e.id=t.event_id
    WHERE e.id = ANY(${openIds}) AND t.status IN ('valid','used') LIMIT 10000`;
  return NextResponse.json({
    at: new Date().toISOString(),
    events: (evs as unknown as { id: string; title: string }[]).filter((e) => openIds.includes(e.id)),
    tickets: tickets.map((t) => ({
      code: String(t.code), holder: String(t.holder_name || ""), doc: String(t.holder_doc || ""),
      seat: String(t.seat || ""), status: String(t.status),
      zone: String(t.zone), event: String(t.event), event_id: String(t.event_id),
    })),
  });
}
