import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { verifyTicketPayload } from "@/lib/tickets";

const Schema = z.object({ payload: z.string().min(3), gate: z.string().max(60).optional() });

export async function POST(req: Request) {
  const s = await getSession();
  if (!s && process.env.REQUIRE_SCANNER_AUTH === "1")
    return NextResponse.json({ error: "Se requiere login de personal" }, { status: 401 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "QR inválido" }, { status: 400 });
  const code = verifyTicketPayload(parsed.data.payload);
  if (!code) return NextResponse.json({ error: "QR falsificado o corrupto" }, { status: 400 });
  const sql = getDb();
  const rows = await sql`
    SELECT t.*, e.title AS event, z.name AS zone, e.org_id
    FROM tickets t JOIN events e ON e.id=t.event_id JOIN zones z ON z.id=t.zone_id
    WHERE t.code=${code} LIMIT 1`;
  const t = rows[0] as Record<string, unknown> | undefined;
  if (!t) {
    return NextResponse.json({ error: "Entrada no existe" }, { status: 404 });
  }
  if (s && String(t.org_id) !== s.orgId) return NextResponse.json({ error: "Entrada de otra organización" }, { status: 403 });
  if (t.status === "cancelled") {
    await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'cancelled', ${parsed.data.gate || ""}, ${s?.userId || null})`;
    return NextResponse.json({ error: "Entrada cancelada" }, { status: 410 });
  }
  if (t.status === "used") {
    await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'duplicate', ${parsed.data.gate || ""}, ${s?.userId || null})`;
    return NextResponse.json({ error: "YA USADA — acceso denegado (duplicado)" }, { status: 409 });
  }
  // Marcado atómico anti-doble-uso
  const upd = await sql`UPDATE tickets SET status='used', used_at=now() WHERE id=${String(t.id)} AND status='valid' RETURNING id`;
  if (!upd[0]) {
    await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'duplicate', ${parsed.data.gate || ""}, ${s?.userId || null})`;
    return NextResponse.json({ error: "YA USADA (carrera detectada)" }, { status: 409 });
  }
  await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'ok', ${parsed.data.gate || ""}, ${s?.userId || null})`;
  return NextResponse.json({ ok: true, code, event: String(t.event), zone: String(t.zone) });
}
