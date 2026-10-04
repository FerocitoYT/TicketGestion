import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { verifyTicketPayload } from "@/lib/tickets";

const Schema = z.object({ payload: z.string().min(3), gate: z.string().max(60).optional() });

export async function POST(req: Request) {
  const s = await getSession();
  // Solo personal (owner/staff/scanner de la organización). Sin sesión no se valida.
  if (!s) return NextResponse.json({ error: "Solo personal: inicia sesión para validar accesos" }, { status: 401 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "QR inválido" }, { status: 400 });
  const code = verifyTicketPayload(parsed.data.payload);
  if (!code) return NextResponse.json({ error: "QR falsificado o corrupto" }, { status: 400 });
  const sql = getDb();
  const rows = await sql`
    SELECT t.*, e.title AS event, z.name AS zone, e.org_id, o.buyer_name, o.buyer_email
    FROM tickets t JOIN events e ON e.id=t.event_id JOIN zones z ON z.id=t.zone_id
    JOIN orders o ON o.id=t.order_id
    WHERE t.code=${code} LIMIT 1`;
  const t = rows[0] as Record<string, unknown> | undefined;
  if (!t) {
    return NextResponse.json({ error: "Entrada no existe" }, { status: 404 });
  }
  if (String(t.org_id) !== s.orgId) return NextResponse.json({ error: "Entrada de otra organización" }, { status: 403 });
  const person = {
    code, event: String(t.event), zone: String(t.zone),
    holder: String(t.holder_name || ""), doc: String(t.holder_doc || ""),
    buyer: String(t.buyer_name || ""), email: String(t.buyer_email || ""),
  };
  const history = await sql`SELECT result, gate, created_at FROM scans WHERE ticket_id=${String(t.id)} ORDER BY created_at DESC LIMIT 5`;
  if (t.status === "cancelled") {
    await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'cancelled', ${parsed.data.gate || ""}, ${s.userId})`;
    return NextResponse.json({ error: "ENTRADA CANCELADA — acceso denegado", ...person, scans: history }, { status: 410 });
  }
  if (t.status === "used") {
    await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'duplicate', ${parsed.data.gate || ""}, ${s.userId})`;
    return NextResponse.json({ error: `YA UTILIZADA — denegar acceso. Titular: ${person.holder}. Primer uso: ${String(t.used_at || "")}`, ...person, scans: history }, { status: 409 });
  }
  // Marcado atómico anti-doble-uso (evita reventa: el primer escaneo quema la entrada)
  const upd = await sql`UPDATE tickets SET status='used', used_at=now() WHERE id=${String(t.id)} AND status='valid' RETURNING id`;
  if (!upd[0]) {
    await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'duplicate', ${parsed.data.gate || ""}, ${s.userId})`;
    return NextResponse.json({ error: "YA UTILIZADA (doble escaneo simultáneo) — denegar acceso", ...person, scans: history }, { status: 409 });
  }
  await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'ok', ${parsed.data.gate || ""}, ${s.userId})`;
  return NextResponse.json({ ok: true, ...person });
}
