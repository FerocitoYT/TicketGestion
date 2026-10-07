import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Foto en vivo del acceso: capacidad, vendidas, validadas, denegadas,
// por zona, por puerta y ritmo por tramos de 15 min (últimas 3 h).
export async function GET(req: Request) {
  const s = await requireRole(["owner", "staff"]);
  if (!s) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const eventId = new URL(req.url).searchParams.get("event") || "";
  const sql = getDb();
  const ev = await sql`SELECT id, title FROM events WHERE id=${eventId} AND org_id=${s.orgId} LIMIT 1`;
  if (!ev[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  const zones = await sql`
    SELECT z.name, z.capacity, z.sold,
      (SELECT COUNT(*) FROM scans sc JOIN tickets t ON t.id=sc.ticket_id WHERE t.zone_id=z.id AND sc.result='ok') AS checked
    FROM zones z WHERE z.event_id=${eventId} ORDER BY z.price_cents`;
  const gates = await sql`
    SELECT COALESCE(NULLIF(gate,''), '—') AS gate,
      COUNT(*) FILTER (WHERE result='ok') AS ok,
      COUNT(*) FILTER (WHERE result != 'ok') AS denied
    FROM scans WHERE event_id=${eventId} GROUP BY 1 ORDER BY 1`;
  const slots = await sql`
    SELECT to_char(date_trunc('hour', created_at) + ((extract(minute FROM created_at)::int / 15) * interval '15 minutes'), 'HH24:MI') AS slot,
      COUNT(*) FILTER (WHERE result='ok') AS n
    FROM scans WHERE event_id=${eventId} AND created_at > now() - interval '3 hours'
    GROUP BY 1 ORDER BY 1`;
  const totals = await sql`
    SELECT COALESCE((SELECT SUM(capacity) FROM zones WHERE event_id=${eventId}),0) AS capacity,
      COALESCE((SELECT SUM(sold) FROM zones WHERE event_id=${eventId}),0) AS sold,
      (SELECT COUNT(*) FROM scans WHERE event_id=${eventId} AND result='ok') AS checked,
      (SELECT COUNT(*) FROM scans WHERE event_id=${eventId} AND result != 'ok') AS denied`;
  return NextResponse.json({
    at: new Date().toISOString(),
    totals: { ...totals[0], capacity: Number(totals[0].capacity), sold: Number(totals[0].sold), checked: Number(totals[0].checked), denied: Number(totals[0].denied) },
    zones: zones.map((z) => ({ name: String(z.name), capacity: Number(z.capacity), sold: Number(z.sold), checked: Number(z.checked) })),
    gates: gates.map((g) => ({ gate: String(g.gate), ok: Number(g.ok), denied: Number(g.denied) })),
    slots: slots.map((x) => ({ slot: String(x.slot), n: Number(x.n) })),
  });
}
