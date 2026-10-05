import { getDb } from "@/lib/db";
import { verifyTicketPayload } from "@/lib/tickets";
import { accessState } from "@/lib/access";

export type DoorUser = { userId: string; orgId: string; role: string };
export type ScanResult = { status: number; body: Record<string, unknown> };

// Núcleo de validación compartido por /api/validar y la sincronización offline.
export async function validateScan(
  user: DoorUser, payload: string, gate = "", eventId?: string
): Promise<ScanResult> {
  const fail = (status: number, body: Record<string, unknown>): ScanResult => ({ status, body });
  const code = verifyTicketPayload(payload);
  if (!code) return fail(400, { error: "QR falsificado o corrupto" });
  const sql = getDb();
  const rows = await sql`
    SELECT t.*, e.title AS event, z.name AS zone, e.org_id, o.buyer_name, o.buyer_email,
           e.status AS estate, COALESCE(s.ends_at, e.ends_at) AS eends, e.access_grace_minutes AS egrace, e.access_closed AS eclosed,
           e.starts_at AS estarts, s.starts_at AS sstarts, e.access_opens_minutes AS eopens
    FROM tickets t JOIN events e ON e.id=t.event_id JOIN zones z ON z.id=t.zone_id
    LEFT JOIN sessions s ON s.id=z.session_id
    JOIN orders o ON o.id=t.order_id
    WHERE t.code=${code} LIMIT 1`;
  const t = rows[0] as Record<string, unknown> | undefined;
  if (!t) return fail(404, { error: "Entrada no existe" });
  if (String(t.org_id) !== user.orgId) return fail(403, { error: "Entrada de otra organización" });
  const ev = {
    id: String(t.event_id),
    title: String(t.event),
    status: String(t.estate),
    starts_at: String(t.estarts),
    ends_at: (t.eends as string | null) || null,
    access_grace_minutes: Number(t.egrace ?? 120),
    access_closed: Boolean(t.eclosed),
    access_opens_minutes: Number(t.eopens ?? 120),
    session_starts_at: (t.sstarts as string | null) || null,
  };
  if (eventId && eventId !== ev.id) {
    return fail(403, { error: "El QR no es de este punto de control", event: ev.title });
  }
  if (user.role !== "owner") {
    const asg = await sql`SELECT 1 FROM event_staff WHERE event_id=${ev.id} AND user_id=${user.userId} LIMIT 1`;
    if (!asg[0]) return fail(403, { error: "No estás asignado a este evento" });
  }
  const st = accessState(ev);
  if (!st.open) {
    // Aún no abre (futuro) → 403; finalizado/cerrado → 410.
    const early = st.reason.startsWith("El control abre");
    return fail(early ? 403 : 410, { error: early ? `Acceso denegado: ${st.reason}` : `Control no operativo: ${st.reason}`, event: ev.title });
  }
  const person = {
    code, event: String(t.event), zone: String(t.zone),
    holder: String(t.holder_name || ""), doc: String(t.holder_doc || ""),
    seat: String(t.seat || ""),
    buyer: String(t.buyer_name || ""), email: String(t.buyer_email || ""),
  };
  const history = await sql`SELECT result, gate, created_at FROM scans WHERE ticket_id=${String(t.id)} ORDER BY created_at DESC LIMIT 5`;
  if (t.status === "cancelled") {
    await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'cancelled', ${gate}, ${user.userId})`;
    return fail(410, { error: "ENTRADA CANCELADA — acceso denegado", ...person, scans: history });
  }
  if (t.status === "used") {
    await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'duplicate', ${gate}, ${user.userId})`;
    return fail(409, { error: `YA UTILIZADA — denegar acceso. Titular: ${person.holder}. Primer uso: ${String(t.used_at || "")}`, ...person, scans: history });
  }
  const upd = await sql`UPDATE tickets SET status='used', used_at=now() WHERE id=${String(t.id)} AND status='valid' RETURNING id`;
  if (!upd[0]) {
    await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'duplicate', ${gate}, ${user.userId})`;
    return fail(409, { error: "YA UTILIZADA (doble escaneo simultáneo) — denegar acceso", ...person, scans: history });
  }
  await sql`INSERT INTO scans (ticket_id, event_id, result, gate, scanned_by) VALUES (${String(t.id)}, ${String(t.event_id)}, 'ok', ${gate}, ${user.userId})`;
  return { status: 200, body: { ok: true, ...person } };
}
