import QRCode from "qrcode";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ticketQrPayload } from "@/lib/tickets";
import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const s = await getSession();
  const { code } = await params;
  // Entradas solo con sesión: evita que un QR reenviado se abra sin control.
  if (!s) redirect(`/login?next=/t/${encodeURIComponent(code)}`);
  let row: Record<string, unknown> | undefined;
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT t.code, t.status, t.holder_name, t.holder_doc, t.seat, t.kind, e.title AS event, e.slug AS event_slug, z.name AS zone, e.starts_at
      FROM tickets t JOIN events e ON e.id=t.event_id JOIN zones z ON z.id=t.zone_id
      WHERE t.code=${code} LIMIT 1`;
    row = rows[0] as Record<string, unknown> | undefined;
  } catch (e) {
    console.error("ticket-load", e);
    return (
      <>
        <h1>Entrada no disponible</h1>
        <p className="alert err">No se pudo conectar con la base de datos. Revisa la conexión o inténtalo de nuevo.</p>
      </>
    );
  }
  if (!row) notFound();
  let qr: string;
  try {
    qr = await QRCode.toDataURL(ticketQrPayload(row.code as string));
  } catch (e) {
    console.error("ticket-qr", e);
    return (
      <>
        <h1>{String(row.event)}</h1>
        <p className="alert err">No se pudo generar el QR. Tu código es <strong>{String(row.code)}</strong>: el personal puede validarlo manualmente en puerta.</p>
      </>
    );
  }
  return (
    <>
      <h1>{String(row.event)}</h1>
      {String(row.kind || "general") !== "general" && (
        <p><span className="badge">ACREDITACIÓN {String(row.kind).toUpperCase()}</span></p>
      )}
      <p className="muted">{String(row.zone)} · Titular: <strong>{String(row.holder_name || "")}</strong>{String(row.holder_doc || "") ? ` · ${row.holder_doc}` : ""}{String(row.seat || "") ? ` · Asiento ${String(row.seat)}` : ""} · {String(row.status)}</p>
      <p><strong>{String(row.code)}</strong></p>
      <div className="qr"><img src={qr} alt="QR entrada" width={220} height={220} /></div>
      <p className="muted">Muestra este QR en puerta. Contiene firma anti-falsificación.</p>
      <div className="row no-print" style={{ marginTop: 12 }}>
        <a className="btn btn-blue" href={`/api/tickets/${encodeURIComponent(String(row.code))}/ics`}>Añadir al calendario</a>
        <PrintButton />
      </div>
      <p className="no-print" style={{ marginTop: 14 }}><a href={`/encuestas/${encodeURIComponent(String(row.event_slug || ""))}`}>Opina sobre este evento</a></p>
    </>
  );
}
