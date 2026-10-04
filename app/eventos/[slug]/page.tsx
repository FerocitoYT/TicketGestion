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
  const totalLeft = zones.reduce((a, z) => a + Math.max(0, available(z)), 0);
  const k = process.env.STRIPE_SECRET_KEY || "";
  const simulated = !(k.startsWith("sk_") && !k.includes("replace_me"));
  const dt = new Date(String(event.starts_at));
  return (
    <>
      <p className="crumbs"><a href="/">Inicio</a> / <a href="/eventos">Agenda</a> / {String(event.title)}</p>
      <section className="event-hero">
        <div className={`banner art-${String(event.category)}`}>
          <span className="badge" style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}>
            {String(event.category)} · {dt.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <h1 className="event-title" style={{ margin: "10px 0 6px", fontSize: 38 }}>{String(event.title)}</h1>
          <p style={{ margin: 0, opacity: 0.93 }}>
            {dt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · {String(event.venue)}
            {String(event.city) ? ` · ${event.city}` : ""}{String(event.address) ? ` · ${event.address}` : ""}
          </p>
        </div>
        <div className="info">
          <div>
            <h2>Sobre el evento</h2>
            <p>{String(event.description || "Toda la información del evento, accesos y horarios.")}</p>
            <div className="row" style={{ margin: "14px 0" }}>
              <span className="badge">{totalLeft} entradas disponibles</span>
              <span className="badge">QR nominativo</span>
              <span className="badge">Anti-reventa en puerta</span>
            </div>
            <h3>Zonas y precios</h3>
            <div className="zones">
              {zones.map((z) => (
                <div key={String(z.id)} className="zone">
                  <div><strong>{String(z.name)}</strong><br /><span className="muted">{available(z)} disponibles</span></div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{(Number(z.price_cents) / 100).toFixed(2)} €</div>
                </div>
              ))}
            </div>
            <h3>Preguntas frecuentes</h3>
            <p className="muted"><strong>¿La entrada lleva mi nombre?</strong> Sí: cada QR es nominativo y en puerta se comprueba el DNI.</p>
            <p className="muted"><strong>¿Puedo revenderla?</strong> No: el primer escaneo quema la entrada y las copias dejan de funcionar.</p>
            <p className="muted"><strong>¿Cómo recibo mis entradas?</strong> Al instante, con QR único por persona, recuperables en Mis entradas.</p>
          </div>
          <aside className="buybox">
            <h3 style={{ marginTop: 0 }}>Comprar entradas</h3>
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
                <label>Cantidad (máx {String(Number((event as Record<string, unknown>).max_per_order ?? 10))} por compra)<input name="qty" type="number" min={1} max={Number((event as Record<string, unknown>).max_per_order ?? 10)} defaultValue={1} required /></label>
                <label>Código promo<input name="promo" placeholder="EARLY10" /></label>
              </div>
              <label>Titulares (uno por línea: “Nombre | DNI | Asiento opcional”)<textarea name="holders" rows={2} placeholder="Ana López | 12345678A | F5-A12" /></label>
              {simulated ? (
                <>
                  <p className="alert ok">Modo pruebas: pago simulado. Tarjeta 4242 4242 4242 4242.</p>
                  <div className="row">
                    <label>Nº tarjeta<input defaultValue="4242 4242 4242 4242" inputMode="numeric" /></label>
                    <label>Cad.<input defaultValue="12/28" /></label>
                    <label>CVC<input defaultValue="123" /></label>
                  </div>
                  <button formAction="/api/checkout">Pagar (simulado)</button>
                </>
              ) : (
                <button formAction="/api/checkout">Comprar con Stripe</button>
              )}
            </form>
          </aside>
        </div>
      </section>
    </>
  );
}
