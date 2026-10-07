import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// Avisa a la lista de espera cuando una zona vuelve a tener sitio.
// Se llama desde el cron y desde el panel tras liberar aforo.
export async function checkWaitlists(appUrl: string): Promise<{ notified: number }> {
  const sql = getDb();
  const zones = await sql`
    SELECT z.id, z.name, z.capacity, z.sold, e.title AS event, e.slug AS eslug
    FROM zones z JOIN events e ON e.id=z.event_id
    WHERE e.status='published' AND z.capacity > z.sold`;
  let notified = 0;
  for (const z of zones) {
    const free = Number(z.capacity) - Number(z.sold);
    if (free <= 0) continue;
    const waiting = await sql`SELECT id, email, qty FROM waitlist
      WHERE zone_id=${z.id} AND notified_at IS NULL AND qty <= ${free} ORDER BY created_at ASC LIMIT 20`;
    for (const w of waiting) {
      await sendEmail(
        String(w.email),
        `¡Sitio libre en ${String(z.name)}: ${String(z.event)}!`,
        `<p>Hola,</p><p>Se liberaron <strong>${w.qty} entrada(s)</strong> en <strong>${String(z.name)}</strong> (${String(z.event)}). Compra aquí antes de que vuelen: <a href="${appUrl}/comprar?zone=${z.id}">Comprar ahora</a>.</p>`
      );
      await sql`UPDATE waitlist SET notified_at=now() WHERE id=${w.id}`;
      notified++;
    }
  }
  return { notified };
}
