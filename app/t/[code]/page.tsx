import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { ticketQrPayload } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT t.code, t.status, t.holder_name, e.title AS event, z.name AS zone, e.starts_at
      FROM tickets t JOIN events e ON e.id=t.event_id JOIN zones z ON z.id=t.zone_id
      WHERE t.code=${code} LIMIT 1`;
    if (!rows[0]) notFound();
    const qr = await QRCode.toDataURL(ticketQrPayload(rows[0].code as string));
    return (
      <>
        <h1>{String(rows[0].event)}</h1>
        <p className="muted">{String(rows[0].zone)} · {String(rows[0].holder_name || "")} · {String(rows[0].status)}</p>
        <p><strong>{String(rows[0].code)}</strong></p>
        <div className="qr"><img src={qr} alt="QR entrada" width={220} height={220} /></div>
        <p className="muted">Muestra este QR en puerta. Contiene firma anti-falsificación.</p>
      </>
    );
  } catch {
    return <p className="muted">No se pudo cargar la entrada.</p>;
  }
}
