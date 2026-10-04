import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getEvent(slug: string) {
  const sql = getDb();
  const ev = await sql`
    SELECT e.*, COALESCE(v.name,'') AS venue, COALESCE(v.city,'') AS city, COALESCE(v.address,'') AS address
    FROM events e LEFT JOIN venues v ON v.id=e.venue_id WHERE e.slug=${slug} LIMIT 1`;
  if (!ev[0]) return null;
  const zones = await sql`SELECT * FROM zones WHERE event_id=${ev[0].id} ORDER BY price_cents ASC`;
  return { event: ev[0] as Record<string, unknown>, zones: zones as Record<string, unknown>[] };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let data: Awaited<ReturnType<typeof getEvent>>;
  try {
    data = await getEvent(slug);
  } catch {
    return <p className="muted">Configura DATABASE_URL para ver eventos.</p>;
  }
  if (!data) notFound();
  const { event, zones } = data;
  const available = (z: Record<string, unknown>) => Number(z.capacity) - Number(z.sold);
  return (
    <>
      <span className="badge">{String(event.category)} · {new Date(String(event.starts_at)).toLocaleString("es-ES")}</span>
      <h1>{String(event.title)}</h1>
      <p className="muted">{String(event.venue)} {String(event.city) ? `· ${event.city}` : ""} {String(event.address) ? `· ${event.address}` : ""}</p>
      <p>{String(event.description || "")}</p>
      <h2>Elige tu zona</h2>
      <form action="/api/checkout" method="post" className="form">
        <input type="hidden" name="eventId" value={String(event.id)} />
        <label>Nombre completo<input name="buyerName" required placeholder="Tu nombre" /></label>
        <label>Email<input name="buyerEmail" type="email" required placeholder="tu@email.com" /></label>
        <label>Zona
          <select name="zoneId" required>
            {zones.map((z) => (
              <option key={String(z.id)} value={String(z.id)} disabled={available(z) <= 0}>
                {String(z.name)} — {(Number(z.price_cents) / 100).toFixed(2)} € ({available(z)} disp.)
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <label>Cantidad<input name="qty" type="number" min={1} max={10} defaultValue={1} required /></label>
          <label>Código promo (opcional)<input name="promo" placeholder="EARLY10" /></label>
        </div>
        <button formAction="/api/checkout">Comprar con Stripe</button>
      </form>
    </>
  );
}
