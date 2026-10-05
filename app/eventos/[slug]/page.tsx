import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getEvent(slug: string) {
  const sql = getDb();
  const ev = await sql`
    SELECT e.*, COALESCE(v.name,'') AS venue, COALESCE(v.city,'') AS city, COALESCE(v.address,'') AS address
    FROM events e LEFT JOIN venues v ON v.id=e.venue_id WHERE e.slug=${slug} LIMIT 1`;
  if (!ev[0]) return null;
  const sessions = await sql`SELECT id, starts_at, ends_at FROM sessions WHERE event_id=${ev[0].id} AND status='scheduled' ORDER BY starts_at ASC`;
  const zones = await sql`SELECT id, name, price_cents, capacity, sold, session_id, seat_rows, seat_cols FROM zones WHERE event_id=${ev[0].id} ORDER BY price_cents ASC`;
  const artists = await sql`SELECT a.name, a.slug FROM event_artists ea JOIN artists a ON a.id=ea.artist_id WHERE ea.event_id=${ev[0].id} ORDER BY a.name`;
  return {
    event: ev[0] as Record<string, unknown>,
    sessions: sessions as unknown as { id: string; starts_at: string; ends_at: string | null }[],
    zones: zones as unknown as { id: string; name: string; price_cents: number; capacity: number; sold: number; session_id: string; seat_rows: number; seat_cols: number }[],
    artists: artists as unknown as { name: string; slug: string }[],
  };
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
  const { event, sessions, zones, artists } = data;
  const totalLeft = zones.reduce((a, z) => a + Math.max(0, Number(z.capacity) - Number(z.sold)), 0);
  const dt = new Date(String(event.starts_at));
  return (
    <>
      <p className="crumbs"><a href="/">Inicio</a> / <a href="/eventos">Agenda</a> / {String(event.title)}</p>
      <section className="event-hero">
        <div className={`banner art-${String(event.category)}`} style={event.image_url ? { backgroundImage: `linear-gradient(rgba(4,20,50,.45),rgba(4,20,50,.45)),url(${String(event.image_url)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          <span className="badge" style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}>
            {String(event.category)} · {sessions.length > 1 ? `${sessions.length} fechas` : dt.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <h1 className="event-title" style={{ margin: "10px 0 6px", fontSize: 38 }}>{String(event.title)}</h1>
          <p style={{ margin: 0, opacity: 0.93 }}>
            {String(event.venue)}{String(event.city) ? ` · ${event.city}` : ""}{String(event.address) ? ` · ${event.address}` : ""}
          </p>
        </div>
        <div className="info">
          <div>
            <h2>Sobre el evento</h2>
            <p>{String(event.description || "Toda la información del evento, accesos y horarios.")}</p>
            {artists.length > 0 && (
              <div className="row" style={{ margin: "10px 0" }}>
                {artists.map((a) => <a key={a.slug} className="badge" href={`/artistas/${a.slug}`}>{a.name}</a>)}
              </div>
            )}
            <div className="row" style={{ margin: "14px 0" }}>
              <span className="badge">{totalLeft} entradas disponibles</span>
              <span className="badge">QR nominativo</span>
              <span className="badge">Anti-reventa en puerta</span>
            </div>
            <h3>Zonas y precios</h3>
            <div className="zones">
              {zones.map((z) => (
                <div key={String(z.id)} className="zone">
                  <div><strong>{String(z.name)}</strong><br /><span className="muted">{Number(z.capacity) - Number(z.sold)} disponibles{Number(z.seat_rows) > 0 ? " · asientos numerados" : ""}</span></div>
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
            {zones.length === 0 || sessions.length === 0 ? (
              <p className="muted">Entradas a la venta próximamente.</p>
            ) : (
              zones.filter((z) => Number(z.capacity) - Number(z.sold) > 0).map((z) => (
                <div key={String(z.id)} className="zone" style={{ marginBottom: 10 }}>
                  <div>
                    <strong>{String(z.name)}</strong><br />
                    <span className="muted">{Number(z.capacity) - Number(z.sold)} disponibles{Number(z.seat_rows) > 0 ? " · elige asiento" : ""}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{(Number(z.price_cents) / 100).toFixed(2)} €</div>
                    <a className="btn btn-blue" style={{ marginTop: 6 }} href={`/comprar?zone=${String(z.id)}`}>Elegir</a>
                  </div>
                </div>
              ))
            )}
            {zones.length > 0 && zones.every((z) => Number(z.capacity) - Number(z.sold) <= 0) && (
              <p className="alert err">Entradas agotadas.</p>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
