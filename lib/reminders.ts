import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// Envía recordatorios a compras pagadas de eventos que empiezan en 20–48 h.
// Marca reminded_at para no duplicar. Pensado para Vercel Cron (diaria) o botón del panel.
export async function runReminders(appUrl: string): Promise<{ sent: number; events: number }> {
  const sql = getDb();
  const evs = await sql`
    SELECT DISTINCT e.id, e.title, e.slug, e.starts_at
    FROM events e JOIN orders o ON o.event_id=e.id
    WHERE e.status='published' AND e.starts_at > now() + interval '20 hours'
      AND e.starts_at < now() + interval '48 hours' AND o.status='paid' AND o.reminded_at IS NULL`;
  let sent = 0;
  for (const ev of evs) {
    const buyers = await sql`
      SELECT DISTINCT buyer_name, buyer_email FROM orders
      WHERE event_id=${ev.id} AND status='paid' AND reminded_at IS NULL LIMIT 500`;
    for (const b of buyers) {
      await sendEmail(
        String(b.buyer_email),
        `Mañana: ${String(ev.title)} — lleva tu QR`,
        `<p>Hola ${String(b.buyer_name)},</p>` +
          `<p>Recuerda: <strong>${String(ev.title)}</strong> es el ${new Date(String(ev.starts_at)).toLocaleString("es-ES")}.</p>` +
          `<p>Lleva tu QR (nominativo + DNI) o recupéralo en <a href="${appUrl}/mis-entradas">Mis entradas</a>. Puedes añadirlo al calendario desde tu entrada.</p>`
      );
      sent++;
    }
    await sql`UPDATE orders SET reminded_at=now() WHERE event_id=${ev.id} AND status='paid' AND reminded_at IS NULL`;
  }
  return { sent, events: evs.length };
}
