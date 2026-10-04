import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { verifyTicketPayload } from "@/lib/tickets";
import { accessState } from "@/lib/access";

const Schema = z.object({
  payload: z.string().min(3),
  gate: z.string().max(60).optional(),
  // Opcional por compatibilidad: si viene, el QR debe ser de ese evento.
  // Si no viene, el evento se resuelve desde el propio QR.
  eventId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  // Solo personal con sesión.
  if (!s) return NextResponse.json({ error: "Solo personal: inicia sesión para validar accesos" }, { status: 401 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Petición inválida (falta evento o QR)" }, { status: 400 });
  const code = verifyTicketPayload(parsed.data.payload);
  if (!code) return NextResponse.json({ error: "QR falsificado o corrupto" }, { status: 400 });
  const sql = getDb();
  const rows = await sql`
    SELECT t.*, e.title AS event, z.name AS zone, e.org_id, o.buyer_name, o.buyer_email,
           e.status AS estate, e.ends_at AS eends, e.access_grace_minutes AS egrace, e.access_closed AS eclosed
    FROM tickets t JOIN events e ON e.id=t.event_id JOIN zones z ON z.id=t.zone_id
    JOIN orders o ON o.id=t.order_id
    WHERE t.code=${code} LIMIT 1`;
  const t = rows[0] as Record<string, unknown> | undefined;
  if (!t) return NextResponse.json({ error: "Entrada no existe" }, { status: 404 });
  if (String(t.org_id) !== s.orgId) return NextResponse.json({ error: "Entrada de otra organización" }, { status: 403 });
  // Evento resuelto desde el propio QR (o verificado si la puerta lo indicó).
  const ev = {
    id: String(t.event_id),
    title: String(t.event),
    status: String(t.estate),
    starts_at: "",
    ends_at: (t.eends as string | null) || null,
    access_grace_minutes: Number(t.egrace ?? 120),
    access_closed: Boolean(t.eclosed),
  };
  if (parsed.data.eventId && parsed.data.eventId !== ev.id) {
    return NextResponse.json({ error: "El QR no es de este punto de control", event: ev.title }, { status: 403 });
  }
  // Vinculación: el propietario valida cualquier evento; el resto solo sus asignados.
  if (s.role !== "owner") {
    const asg = await sql`SELECT 1 FROM event_staff WHERE event_id=${ev.id} AND user_id=${s.userId} LIMIT 1`;
    if (!asg[0]) return NextResponse.json({ error: "No estás asignado a este evento" }, { status: 403 });
  }
  // Ventana operativa: ni eventos finalizados (auto o manual).
  const st = accessState(ev);
  if (!st.open) return NextResponse.json({ error: `Control no operativo: ${st.reason}`, event: ev.title }, { status: 410 });
  const person = {
    code, event: String(t.event), zone: String(t.zone),
    holder: String(t.holder_name || ""), doc: String(t.holder_doc || ""),
    seat: String((t as Record<string, unknown>).seat || ""),
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
